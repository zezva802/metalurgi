import { describe, expect, it } from "vitest";
import { decide } from "@/lib/supervisor/decide";
import { checkMandate, generateKeys, signCanonical, type MandateState } from "@/lib/supervisor/mandate";
import { BEFORE_EXPIRY, MANDATE, PROPOSAL_A } from "./fixtures";

const nino = generateKeys();
const signature = signCanonical(MANDATE, nino.privateKey);
const state: MandateState = { principalPublicKey: nino.publicKey, uses: 0, spent: 0, now: BEFORE_EXPIRY };

describe("decide (stub)", () => {
  it("scenario A: passing mandate → EXECUTE", () => {
    const mandate = checkMandate(MANDATE, signature, PROPOSAL_A, state);
    expect(decide({ mandate }).outcome).toBe("EXECUTE");
  });

  it("scenario D: €950 → BLOCK, 'Exceeds the €800 limit'", () => {
    const mandate = checkMandate(MANDATE, signature, { ...PROPOSAL_A, amount: 950 }, state);
    const decision = decide({ mandate });
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons.some((r) => r.startsWith("Exceeds the €800 limit"))).toBe(true);
  });

  it("BLOCK lists every failed rule as a reason", () => {
    const mandate = checkMandate(MANDATE, signature, { ...PROPOSAL_A, amount: 950, city: "Lyon" }, state);
    expect(decide({ mandate }).reasons).toEqual(mandate.failures.map((f) => f.message));
  });
});
