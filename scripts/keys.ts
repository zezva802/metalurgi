// Writes synthetic Ed25519 demo keys to data/keys/ (gitignored).
// Existing keys are kept so stored signatures stay valid; pass --force to regenerate.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateKeys } from "../lib/supervisor/mandate";

const KEY_DIR = join(process.cwd(), "data", "keys");
const IDS = ["nino", "agent_travel_01", "agent_legacy_01"];
const force = process.argv.includes("--force");

mkdirSync(KEY_DIR, { recursive: true });

for (const id of IDS) {
  const privatePath = join(KEY_DIR, `${id}.private.pem`);
  const publicPath = join(KEY_DIR, `${id}.public.pem`);
  if (!force && existsSync(privatePath) && existsSync(publicPath)) {
    console.log(`kept     ${id}`);
    continue;
  }
  const { publicKey, privateKey } = generateKeys();
  writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
  console.log(`created  ${id}`);
}
