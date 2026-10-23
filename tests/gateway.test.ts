import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeys, signCanonical } from "@/lib/supervisor/mandate";
import { resetStore, saveMandate } from "@/lib/store";
import { evaluatePayment } from "@/lib/gateway";
import { BEFORE_EXPIRY, MANDATE, PROPOSAL_A } from "./fixtures";

const nino = generateKeys();
vi.mock("@/lib/keys", () => ({ loadPublicKey: () => nino.publicKey }));

beforeEach(() => {
  resetStore();
  saveMandate({ mandate: MANDATE, signature: signCanonical(MANDATE, nino.privateKey), signed_at: "2026-09-01T09:00:00Z" });
});

describe("evaluatePayment", () => {
  it("scenario A → EXECUTE", () => {
    expect(evaluatePayment(PROPOSAL_A, BEFORE_EXPIRY).decision.outcome).toBe("EXECUTE");
  });

  it("Phase 1 checkpoint: €950 → BLOCK, 'Exceeds the €800 limit'", () => {
    const { decision } = evaluatePayment({ ...PROPOSAL_A, amount: 950 }, BEFORE_EXPIRY);
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons).toEqual(["Exceeds the €800 limit (€950 requested)"]);
  });

  it("unknown mandate → BLOCK", () => {
    const { decision } = evaluatePayment({ ...PROPOSAL_A, mandate_id: "m_404" }, BEFORE_EXPIRY);
    expect(decision).toEqual({ outcome: "BLOCK", reasons: ["No mandate m_404 on file"] });
  });
});
