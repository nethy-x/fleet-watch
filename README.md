# Fleet Watch — take-home assignment

At **Simplicity** we build the software that runs fleets of patrol robots: quadrupeds
and humanoids that walk a site on their own, and the console operators use to watch
them. This assignment is a small slice of that console, on the same stack we use every
day.

**Time: 2–3 hours. Stop at 3 hours, wherever you are.** We do not expect everything to
be finished. We want to see what you choose to do first, how you do it, and how clearly
you explain what you left out. Unfinished and well explained beats finished and fragile.

Use the tools you normally use, AI assistants included. You own every line you hand in:
in the follow-up call we will ask you to explain it and to change it.

---

## 1. What you are building

An operator of **Northwind Security** opens Fleet Watch and wants two answers:

- **Which of my robots are alive right now**, and how much battery do they have?
- **What just happened** to a given robot?

Robots report by themselves. Each one posts a stream of events to the server. You build
the server side that takes those events in, and the screen that shows them.

```
 robots ──POST /api/robot/events──►  server (NestJS + Prisma + Postgres)  ◄──REST──  web (React)
 (simulated for you)                 you build this                                  you build this
```

A robot simulator is included. It behaves like real robots do, which is the
interesting part — read §4 carefully.

## 2. Getting started

You need **Node 20+** and **Docker**.

```bash
npm run setup        # Postgres in Docker, installs, migrates, seeds 9 robots
npm run dev:server   # http://localhost:3100/api
npm run dev:web      # http://localhost:5180
npm run simulate     # the robots start reporting (Ctrl-C prints a summary)
```

Ports: API `3100`, web `5180`, Postgres `5440`. `npm test` runs the server tests against
their own database; `npm run typecheck` checks both projects.

What is already there, so you do not spend your time on plumbing:

| Where | What |
|---|---|
| `server/prisma/schema.prisma` | `Organization` and `Robot`, seeded from `fleet.seed.json`. **The event model is yours to design.** |
| `server/src/auth/robot-token.guard.ts` | Authenticates a robot by its token; `@CurrentRobot()` hands you the robot. |
| `server/src/auth/operator.guard.ts` | Stands in for a signed-in session (there is no login here); `@CurrentOperator()` hands you who is asking. |
| `server/src/ingest/robot-events.controller.ts` | `POST /api/robot/events` — answers 501. **Your work starts here.** |
| `server/src/robots/` | `GET /api/robots` — returns bare rows. |
| `server/test/` | A jest + supertest harness over a real Postgres (`createTestApp`, `resetDb`). |
| `web/` | Vite + React + TypeScript + Tailwind with our design tokens, React Query, `Button`, `Badge`, and a placeholder screen that proves the wiring. |
| `simulator/simulate.mjs` | The robots. `--seed`, `--duration <s>`, `--only Rex,Bolt`, `--quiet`. |

Useful: `npm --prefix server run db:migrate` (create a migration after a schema change),
`npm --prefix server run db:reset` (empty the database and re-seed).

## 3. Robot wire format

This is fixed — the robots are already deployed. Do not change it or the simulator.

```http
POST /api/robot/events
Authorization: Bearer <robot token>
Content-Type: application/json

{
  "events": [
    { "id": "3f0c…", "type": "MISSION_STARTED", "at": "2026-03-02T14:02:31.120Z", "data": { "route": "north-loop" } },
    { "id": "9a41…", "type": "PERSON_SEEN",     "at": "2026-03-02T14:03:05.800Z", "data": { "people": 2 } }
  ]
}
```

- `id` — a UUID the robot mints when the event happens.
- `type` — see the table below.
- `at` — the robot's own wall clock at that moment.
- `data` — optional, depends on the type.
- A request carries up to 50 events, oldest first.
- **The robot treats any 2xx as "taken".** On anything else, or no answer within 5 s,
  it keeps the batch and sends the same batch again later. It sends nothing newer
  until that batch is taken, and it never reads a response body.

| Type | `data` | Reads as | Severity |
|---|---|---|---|
| `HEARTBEAT` | `{ soc }` — battery, 0–100 | *(not an operator event — see §4)* | — |
| `MISSION_STARTED` | `{ route }` | Mission started · north-loop | info |
| `MISSION_COMPLETED` | `{ seconds }` | Mission completed · 12m 40s | info |
| `UNDOCKED` | — | Undocked | info |
| `DOCKED` | — | Docked | info |
| `PERSON_SEEN` | `{ people }` | Person seen · 2 people | alarm |
| `PERSON_GONE` | `{ seconds }` | Person gone · 38s | info |
| `STUCK` | `{ reason }` | Stuck · blocked path | warning |
| `LOST` | — | Lost | alarm |
| `BATTERY_LOW` | `{ soc }` | Battery low · 19% | warning |
| `BATTERY_CRITICAL` | `{ soc }` | Battery critical · 8% | alarm |
| `ERROR` | `{ message }` | Error · lidar timeout | alarm |

## 4. What robots are like

These are facts about the fleet, not hints to decode. Your solution has to hold up under
all of them, and the simulator exercises each one.

- **A robot is an embedded computer on WiFi.** Its uplink drops. Gaps of up to about
  20 seconds are routine and do not mean anything is wrong. Gaps of minutes or hours
  happen too: the robot keeps working and delivers what it recorded once it is back.
- **A response can be lost on the way back.** The server took the batch; the robot
  never learned that.
- **A robot's clock can be wrong** — by hours or days. It boots before it syncs time,
  and some never sync.
- **Firmware is updated robot by robot**, and not always after the server. A robot may
  send something this server version has not heard of.
- **A robot with an uplink sends a `HEARTBEAT` every 5 seconds.** A heartbeat it cannot
  send is thrown away, not kept for later.
- **A robot may be registered and never switched on.**

## 5. What we ask for

### Server

1. **Take in events** on `POST /api/robot/events`, so that what the operator later sees
   is true under everything in §4.
2. **Robots, for the browser**: each robot with whether it is **online**, **offline** or
   **never seen**, when it was last heard from, and its battery.
3. **A robot's events, for the browser**: newest first, in pages — a robot collects
   thousands of them.
4. **An operator sees only their own organization.** Northwind's operator must not be
   able to read anything of Harbor Logistics, and the other way round.
5. **A few tests** for the rules you think are most likely to break in production.
   We are not looking for coverage.

The browser-facing API is yours to design.

### Web

Design: **[Figma — Fleet Watch](https://www.figma.com/design/I5vY2jRCgzQNeJ3EgUgXYC)** (PNG exports are in `docs/design/` if you
cannot open it).

6. **The Robots screen**: the card grid with status, type, battery and last seen. It
   stays current without a reload.
7. **The events panel**: selecting a robot opens its events — the list, "Load more", and
   the loading, empty and error states from the *States* page.

### Notes

8. **`NOTES.md`**, one page at most (a template is in the repo): the decisions you made
   and why, what you left out, what you would do next, and how you used AI tools.

### If you have time left

None of this is expected. One honest line in `NOTES.md` about how you would do it is
worth as much as a rushed implementation.

- The latest event on each robot card, and the severity filter chips.
- The mobile layout.
- Push instead of polling.
- Anything you think the operator needs and we did not ask for.

## 6. House rules

These are the rules of the real codebase; they apply here too.

- Keep the stack. A small library is fine if you say why; no UI kits.
- TypeScript stays strict. `npm run typecheck` and `npm test` pass when you hand in.
- Schema changes go through Prisma migrations.
- REST data goes through React Query. Nothing polls faster than every 2 seconds.
- **Colour is an accent, ink is text.** Brand colours are dots, icons and fills — never
  small coloured label text. Contrast meets WCAG AA.
- **No explanatory text in the UI.** A screen shows data, labels, bare empty states
  ("No events yet") and errors. It never explains itself: no captions, no how-to, no
  tooltips that carry a sentence.
- **Every state is real**: hover, keyboard focus, disabled, loading, empty, error.
  Everything clickable is reachable and usable from the keyboard.
- Comments state what is true now and why it must stay so — not what you changed.

## 7. Handing in

- Commit as you go; we read the history.
- Send us a private repository (invite [`nethy-x`](https://github.com/nethy-x)) or a zip that includes
  `.git`. Please do not publish the assignment or your solution.
- Questions are welcome at any point:
  [juraj.budai@onesimplicity.com](mailto:juraj.budai@onesimplicity.com). Asking is not held against you;
  if you would rather not wait for an answer, write your assumption in `NOTES.md` and
  carry on.

**What happens next:** a 45-minute call. You walk us through what you built, we ask
about the decisions in your notes, and we make one small change together.

## 8. What we look at

- Does what the operator sees stay true under §4?
- The data model and the API you designed, and whether you can defend them.
- Code we would be happy to maintain: clear names, small seams, no dead weight.
- The screen against the design: layout, tokens, states, keyboard.
- Tests that would catch a real regression.
- Judgment: what you did first, what you cut, and how plainly you say so.
