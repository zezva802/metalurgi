import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Synthetic demo keys written by `npm run keys` to data/keys/.

const KEY_DIR = join(process.cwd(), "data", "keys");

function readKey(file: string): string {
  try {
    return readFileSync(join(KEY_DIR, file), "utf8");
  } catch {
    throw new Error(`Missing data/keys/${file}. Run \`npm run keys\` first.`);
  }
}

export function loadPrivateKey(id: string): KeyObject {
  return createPrivateKey(readKey(`${id}.private.pem`));
}

export function loadPublicKey(id: string): KeyObject {
  return createPublicKey(readKey(`${id}.public.pem`));
}
