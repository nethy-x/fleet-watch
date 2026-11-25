// Once per `npm test`: bring the test database up to the current migrations.
import "dotenv/config";
import { execSync } from "node:child_process";

export default function globalSetup(): void {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (server/.env)");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
