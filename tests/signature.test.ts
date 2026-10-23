import { describe, expect, it } from "vitest";
import { generateKeys, signCanonical, verifyCanonical } from "@/lib/supervisor/mandate";
import { MANDATE } from "./fixtures";

const mandate = MANDATE;

const nino = generateKeys();
const other = generateKeys();

describe("Ed25519 signatures", () => {
  it("sign then verify is true", () => {
    const signature = signCanonical(mandate, nino.privateKey);
    expect(verifyCanonical(mandate, signature, nino.publicKey)).toBe(true);
  });

  it("still verifies when key order differs", () => {
    const signature = signCanonical(mandate, nino.privateKey);
    const reordered = Object.fromEntries(Object.entries(mandate).reverse());
    expect(verifyCanonical(reordered, signature, nino.publicKey)).toBe(true);
  });

  it("scenario E: max_amount edited to 2000 after signing is false", () => {
    const signature = signCanonical(mandate, nino.privateKey);
    expect(verifyCanonical({ ...mandate, max_amount: 2000 }, signature, nino.publicKey)).toBe(false);
  });

  it("someone else's key is false", () => {
    const signature = signCanonical(mandate, other.privateKey);
    expect(verifyCanonical(mandate, signature, nino.publicKey)).toBe(false);
  });

  it("works with PEM strings", () => {
    const privatePem = nino.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicPem = nino.publicKey.export({ type: "spki", format: "pem" }).toString();
    const signature = signCanonical(mandate, privatePem);
    expect(verifyCanonical(mandate, signature, publicPem)).toBe(true);
  });

  it("garbage signature or key is false, not an exception", () => {
    expect(verifyCanonical(mandate, "not-a-signature", nino.publicKey)).toBe(false);
    expect(verifyCanonical(mandate, signCanonical(mandate, nino.privateKey), "not a key")).toBe(false);
  });
});
