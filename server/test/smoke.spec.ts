import request from "supertest";
import { createTestApp, resetDb, TestApp } from "./app";

describe("starter smoke", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetDb(t.prisma));
  afterAll(() => t.app.close());

  it("is up", async () => {
    const res = await request(t.app.getHttpServer()).get("/api/health").expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("serves the robots lane", async () => {
    await request(t.app.getHttpServer()).get("/api/robots").expect(200);
  });

  it("refuses the robot lane without a robot token", async () => {
    await request(t.app.getHttpServer()).post("/api/robot/events").send({ events: [] }).expect(401);
  });
});
