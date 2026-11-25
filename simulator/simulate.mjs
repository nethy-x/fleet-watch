#!/usr/bin/env node
// Fleet Watch robot simulator. No dependencies — Node 20+.
//
//   node simulator/simulate.mjs [--url http://localhost:3100] [--seed 1]
//                               [--duration <seconds>] [--only Rex,Bolt] [--quiet]
//
// Each robot of ../fleet.seed.json (except the ones that never come online) runs a
// small patrol loop and reports over `POST /api/robot/events`, exactly as described
// in the README (§ Robot wire format). Robots are not equally well behaved; the
// README's "What robots are like" is the specification, this file is one fleet
// that follows it.
//
// The run is deterministic for a given --seed apart from wall-clock timing.
// On exit (Ctrl-C or --duration) it prints what each robot produced and writes the
// same to simulator/last-run.json.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── arguments ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}
const BASE_URL = String(arg("url", "http://localhost:3100")).replace(/\/$/, "");
const SEED = Number(arg("seed", 1));
const DURATION_S = arg("duration") === undefined ? null : Number(arg("duration"));
const ONLY = arg("only") === undefined ? null : new Set(String(arg("only")).split(","));
const QUIET = args.includes("--quiet");

const TICK_MS = 1000;
const HEARTBEAT_EVERY_TICKS = 5;
const MAX_BATCH = 50;
const REQUEST_TIMEOUT_MS = 5000;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ── the fleet ────────────────────────────────────────────────────────────────

/** How each robot differs from a well-behaved one. A robot not listed is ordinary. */
const PROFILES = {
  Rex: {},
  // Came back from a day without uplink: uploads what it recorded meanwhile.
  // Its uplink also loses responses, so it re-sends batches the server already took.
  Bolt: { spoolEvents: 150, spoolSpanMs: 30 * HOUR, resendChance: 0.3 },
  // Its clock never synced.
  Ghost: { clockOffsetMs: 3 * DAY },
  // Weak WiFi at one end of its route: short gaps, and a battery that is nearly flat.
  Pixel: { startSoc: 23, drain: 3, gapEveryTicks: 40, gapTicks: 12 },
  // Runs newer firmware than the server knows about; its clock is behind.
  Atlas: { clockOffsetMs: -90 * MIN, newFirmware: true },
  // Loses its uplink for minutes at a time and keeps working.
  Nova: { gapEveryTicks: 180, gapTicks: 120, firstGapAtTick: 60 },
  // Registered, never switched on.
  Echo: { neverOnline: true },
  Kilo: {},
  Lima: {},
};

const ROUTES = ["north-loop", "perimeter", "warehouse-a", "loading-dock", "east-fence"];
const STUCK_REASONS = ["blocked path", "door closed", "slippery floor", "narrow passage"];
const ERRORS = ["lidar timeout", "camera stream stalled", "localization diverged"];

// ── deterministic randomness ─────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRandom(seed) {
  const next = mulberry32(seed);
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (list) => list[int(0, list.length - 1)],
    uuid: () => {
      const hex = Array.from({ length: 32 }, () => int(0, 15).toString(16));
      hex[12] = "4";
      hex[16] = "89ab"[int(0, 3)];
      const s = hex.join("");
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}

// ── one robot ────────────────────────────────────────────────────────────────

class SimRobot {
  constructor(row, profile, index) {
    this.name = row.name;
    this.token = row.token;
    this.profile = profile;
    this.rand = makeRandom(SEED * 7919 + index * 104729);
    this.tick = 0;

    // The world.
    this.soc = profile.startSoc ?? this.rand.int(55, 95);
    this.state = "DOCKED";
    this.stateTicksLeft = this.rand.int(4, 12);
    this.missionTicks = 0;
    this.personTicksLeft = 0;
    this.personSeenForTicks = 0;
    this.warnedLow = false;
    this.warnedCritical = false;

    // The uplink.
    this.queue = []; // events not yet handed to a request
    this.inflight = null; // { events, attempts } being sent or waiting for a retry
    this.resend = []; // batches the server acknowledged that will be sent again
    this.sending = false;
    this.nextAttemptAt = 0;

    this.stats = {
      produced: 0,
      heartbeatsProduced: 0,
      heartbeatsDropped: 0,
      acknowledged: new Set(),
      acknowledgedHeartbeats: 0,
      duplicateDeliveries: 0,
      rejectedAttempts: 0,
      lastStatus: null,
      byType: {},
    };

    if (profile.spoolEvents) this.fillSpool(profile.spoolEvents, profile.spoolSpanMs);
  }

  robotClock(offsetMs = 0) {
    return new Date(Date.now() + (this.profile.clockOffsetMs ?? 0) + offsetMs).toISOString();
  }

  emit(type, data, offsetMs = 0) {
    const event = { id: this.rand.uuid(), type, at: this.robotClock(offsetMs) };
    if (data !== undefined) event.data = data;
    this.queue.push(event);
    this.stats.produced += 1;
    this.stats.byType[type] = (this.stats.byType[type] ?? 0) + 1;
    return event;
  }

  /** What the robot recorded while it had no uplink, oldest first. */
  fillSpool(count, spanMs) {
    const step = spanMs / count;
    let onMission = false;
    for (let i = 0; i < count; i++) {
      const offset = -spanMs + i * step + this.rand.int(0, Math.floor(step * 0.6));
      if (!onMission) {
        this.emit("UNDOCKED", undefined, offset);
        this.emit("MISSION_STARTED", { route: this.rand.pick(ROUTES) }, offset + 1500);
        onMission = true;
        i += 1;
        continue;
      }
      const roll = this.rand.next();
      if (roll < 0.3) {
        this.emit("PERSON_SEEN", { people: this.rand.int(1, 3) }, offset);
        this.emit("PERSON_GONE", { seconds: this.rand.int(8, 90) }, offset + 20000);
        i += 1;
      } else if (roll < 0.42) {
        this.emit("STUCK", { reason: this.rand.pick(STUCK_REASONS) }, offset);
      } else if (roll < 0.47) {
        this.emit("LOST", undefined, offset);
      } else if (roll < 0.52) {
        this.emit("ERROR", { message: this.rand.pick(ERRORS) }, offset);
      } else {
        this.emit("MISSION_COMPLETED", { seconds: this.rand.int(240, 1500) }, offset);
        this.emit("DOCKED", undefined, offset + 30000);
        onMission = false;
        i += 1;
      }
    }
  }

  inGap() {
    const { gapEveryTicks, gapTicks, firstGapAtTick } = this.profile;
    if (!gapEveryTicks) return false;
    const start = firstGapAtTick ?? gapEveryTicks;
    if (this.tick < start) return false;
    return (this.tick - start) % (gapEveryTicks + gapTicks) < gapTicks;
  }

  stepWorld() {
    const rand = this.rand;
    const drain = this.profile.drain ?? 1;

    if (this.state === "DOCKED") {
      this.soc = Math.min(100, this.soc + 0.9);
      if (this.soc > 30) {
        this.warnedLow = false;
        this.warnedCritical = false;
      }
      this.stateTicksLeft -= 1;
      if (this.stateTicksLeft <= 0 && this.soc >= 35) {
        this.emit("UNDOCKED");
        this.emit("MISSION_STARTED", { route: rand.pick(ROUTES) });
        this.state = "MISSION";
        this.stateTicksLeft = rand.int(40, 90);
        this.missionTicks = 0;
      }
      return;
    }

    if (this.state === "RETURNING") {
      this.soc = Math.max(1, this.soc - 0.1 * drain);
      this.stateTicksLeft -= 1;
      if (this.stateTicksLeft <= 0) {
        this.emit("DOCKED");
        this.state = "DOCKED";
        this.stateTicksLeft = rand.int(12, 30);
      }
      return;
    }

    // MISSION
    this.missionTicks += 1;
    this.stateTicksLeft -= 1;
    this.soc = Math.max(1, this.soc - 0.18 * drain);

    if (this.personTicksLeft > 0) {
      this.personTicksLeft -= 1;
      this.personSeenForTicks += 1;
      if (this.personTicksLeft === 0) {
        this.emit("PERSON_GONE", { seconds: this.personSeenForTicks });
      }
    } else if (rand.chance(0.035)) {
      this.emit("PERSON_SEEN", { people: rand.int(1, 3) });
      this.personTicksLeft = rand.int(5, 25);
      this.personSeenForTicks = 0;
    }

    if (rand.chance(0.012)) this.emit("STUCK", { reason: rand.pick(STUCK_REASONS) });
    if (rand.chance(0.003)) this.emit("LOST");
    if (rand.chance(0.004)) this.emit("ERROR", { message: rand.pick(ERRORS) });
    if (this.profile.newFirmware && rand.chance(0.03)) {
      if (rand.chance(0.7)) this.emit("THERMAL_THROTTLE", { tempC: rand.int(71, 88) });
      else this.emit("FIRMWARE_UPDATED", { version: `2.${rand.int(4, 9)}.${rand.int(0, 12)}` });
    }

    if (!this.warnedLow && this.soc < 20) {
      this.warnedLow = true;
      this.emit("BATTERY_LOW", { soc: Math.round(this.soc) });
    }
    const critical = this.soc < 10;
    if (critical && !this.warnedCritical) {
      this.warnedCritical = true;
      this.emit("BATTERY_CRITICAL", { soc: Math.round(this.soc) });
    }

    if (this.stateTicksLeft <= 0 || critical) {
      if (this.personTicksLeft > 0) {
        this.emit("PERSON_GONE", { seconds: this.personSeenForTicks });
        this.personTicksLeft = 0;
      }
      this.emit("MISSION_COMPLETED", { seconds: this.missionTicks });
      this.state = "RETURNING";
      this.stateTicksLeft = rand.int(5, 10);
    }
  }

  step() {
    this.tick += 1;
    this.stepWorld();

    const offline = this.inGap();
    if (this.tick % HEARTBEAT_EVERY_TICKS === 0) {
      this.stats.heartbeatsProduced += 1;
      // A heartbeat says "alive now": one that cannot be sent is not kept for later.
      if (offline) this.stats.heartbeatsDropped += 1;
      else this.queue.push({ id: this.rand.uuid(), type: "HEARTBEAT", at: this.robotClock(), data: { soc: Math.round(this.soc) } });
    }
    if (!offline) void this.pump();
  }

  async pump() {
    if (this.sending || Date.now() < this.nextAttemptAt) return;

    let batch;
    let isResend = false;
    if (this.inflight) {
      batch = this.inflight;
    } else if (this.resend.length > 0 && this.resend[0].at <= Date.now()) {
      batch = { events: this.resend.shift().events, attempts: 0 };
      isResend = true;
    } else if (this.queue.length > 0) {
      batch = { events: this.queue.splice(0, MAX_BATCH), attempts: 0 };
      this.inflight = batch;
    } else {
      return;
    }

    this.sending = true;
    batch.attempts += 1;
    let status = 0;
    try {
      const res = await fetch(`${BASE_URL}/api/robot/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ events: batch.events }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      status = res.status;
      await res.arrayBuffer().catch(() => undefined);
    } catch {
      status = 0; // unreachable or timed out
    }
    this.sending = false;
    this.stats.lastStatus = status;

    const ok = status >= 200 && status < 300;
    if (ok) {
      if (isResend) {
        this.stats.duplicateDeliveries += 1;
        log(this.name, `↻ re-sent ${batch.events.length} already acknowledged → ${status}`);
        return;
      }
      for (const e of batch.events) {
        if (e.type === "HEARTBEAT") this.stats.acknowledgedHeartbeats += 1;
        else this.stats.acknowledged.add(e.id);
      }
      this.inflight = null;
      const shown = batch.events.filter((e) => e.type !== "HEARTBEAT").map((e) => e.type);
      if (shown.length > 0) {
        const retried = batch.attempts > 1 ? ` (attempt ${batch.attempts})` : "";
        log(this.name, `→ ${summarize(shown)}${retried} → ${status}`);
      }
      // The response was lost on the way back: the robot cannot tell and sends again.
      if (this.profile.resendChance && this.rand.chance(this.profile.resendChance)) {
        this.resend.push({ events: batch.events, at: Date.now() + this.rand.int(1000, 4000) });
      }
      return;
    }

    // Anything but a 2xx: keep the batch, in order, and try again later.
    if (!isResend) {
      this.stats.rejectedAttempts += 1;
      const waitS = Math.min(15, 2 ** Math.min(batch.attempts, 4));
      this.nextAttemptAt = Date.now() + waitS * 1000;
      const what = status === 0 ? "no answer" : String(status);
      log(
        this.name,
        `✗ ${what} — keeping ${batch.events.length} events, retry in ${waitS}s (${this.queue.length} more waiting)`,
        true,
      );
    }
  }

  report() {
    const waiting =
      this.queue.filter((e) => e.type !== "HEARTBEAT").length +
      (this.inflight ? this.inflight.events.filter((e) => e.type !== "HEARTBEAT").length : 0);
    return {
      name: this.name,
      events: this.stats.produced,
      acknowledged: this.stats.acknowledged.size,
      waiting,
      duplicateDeliveries: this.stats.duplicateDeliveries,
      rejectedAttempts: this.stats.rejectedAttempts,
      heartbeats: this.stats.acknowledgedHeartbeats,
      lastStatus: this.stats.lastStatus,
      byType: this.stats.byType,
      acknowledgedIds: [...this.stats.acknowledged],
    };
  }
}

// ── output ───────────────────────────────────────────────────────────────────

function summarize(types) {
  const counts = new Map();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  const parts = [...counts].map(([t, n]) => (n > 1 ? `${t}×${n}` : t));
  return parts.length > 4 ? `${types.length} events` : parts.join(", ");
}

function log(name, message, always = false) {
  if (QUIET && !always) return;
  const time = new Date().toLocaleTimeString("en-GB");
  console.log(`${time}  ${name.padEnd(6)} ${message}`);
}

function printSummary(robots, startedAt) {
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\nRun: ${seconds}s, seed ${SEED}, ${BASE_URL}`);
  console.log(
    "robot   events  acknowledged  waiting  re-sent batches  refused attempts  heartbeats",
  );
  for (const r of robots.map((x) => x.report())) {
    console.log(
      [
        r.name.padEnd(7),
        String(r.events).padStart(6),
        String(r.acknowledged).padStart(13),
        String(r.waiting).padStart(8),
        String(r.duplicateDeliveries).padStart(16),
        String(r.rejectedAttempts).padStart(17),
        String(r.heartbeats).padStart(11),
      ].join(" "),
    );
  }
  console.log(
    "\nevents = produced, heartbeats excluded · acknowledged = distinct events a 2xx covered",
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

const fleet = JSON.parse(readFileSync(new URL("../fleet.seed.json", import.meta.url), "utf8"));
const robots = fleet.robots
  .map((row, index) => ({ row, index, profile: PROFILES[row.name] ?? {} }))
  .filter(({ row, profile }) => !profile.neverOnline && (!ONLY || ONLY.has(row.name)))
  .map(({ row, profile, index }) => new SimRobot(row, profile, index));

if (robots.length === 0) {
  console.error("no robots to simulate (check --only)");
  process.exit(1);
}

const startedAt = Date.now();
console.log(
  `simulating ${robots.map((r) => r.name).join(", ")} → ${BASE_URL}/api/robot/events (Ctrl-C to stop)\n`,
);

const timer = setInterval(() => {
  for (const robot of robots) robot.step();
  if (DURATION_S !== null && Date.now() - startedAt >= DURATION_S * 1000) finish();
}, TICK_MS);

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  clearInterval(timer);
  printSummary(robots, startedAt);
  const out = fileURLToPath(new URL("./last-run.json", import.meta.url));
  writeFileSync(
    out,
    JSON.stringify(
      {
        seed: SEED,
        url: BASE_URL,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        robots: robots.map((r) => r.report()),
      },
      null,
      2,
    ),
  );
  console.log(`written ${out}`);
  process.exit(0);
}

process.on("SIGINT", finish);
process.on("SIGTERM", finish);
