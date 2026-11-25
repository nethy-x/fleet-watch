// Creates server/.env from server/.env.example on first setup; never overwrites.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const env = fileURLToPath(new URL("../server/.env", import.meta.url));
const example = fileURLToPath(new URL("../server/.env.example", import.meta.url));
if (!existsSync(env)) {
  copyFileSync(example, env);
  console.log("created server/.env");
}
