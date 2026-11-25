// Runs in every jest worker before the specs: the suite talks to the TEST database.
import "dotenv/config";

if (!process.env.DATABASE_URL_TEST) throw new Error("DATABASE_URL_TEST is not set (server/.env)");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
