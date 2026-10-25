import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeys, signCanonical } from "@/lib/supervisor/mandate";
import { resetStore, revokeMandate, saveMandate } from "@/lib/store";
import { evaluatePayment } from "@/lib/gateway";
import type { Proposal } from "@/lib/supervisor/proposal";
import { BEFORE_EXPIRY, MANDATE, PROPOSAL_A } from "./fixtures";

const nino = generateKeys();
const agent = generateKeys();
// The gateway loads the principal key and each agent's key by id; mock both to our in-test keys.
vi.mock("@/lib/keys", () => ({
  loadPublicKey: (id: string) => (id === "nino" ? nino.publicKey : agent.publicKey),
}));

// A proposal is signed by the agent over its canonical JSON.
const sign = (proposal: Proposal) => signCanonical(proposal, agent.privateKey);

beforeEach(() => {
  resetStore();
  saveMandate({ mandate: MANDATE, signature: signCanonical(MANDATE, nino.privateKey), signed_at: "2026-09-01T09:00:00Z" });
});

describe("evaluatePayment", () => {
  it("scenario A → EXECUTE", () => {
    expect(evaluatePayment(PROPOSAL_A, sign(PROPOSAL_A), BEFORE_EXPIRY).decision.outcome).toBe("EXECUTE");
  });

  it("Phase 1 checkpoint: €950 → BLOCK, 'Exceeds the €800 limit'", () => {
    const p = { ...PROPOSAL_A, amount: 950 };
    const { decision } = evaluatePayment(p, sign(p), BEFORE_EXPIRY);
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons).toContain("Exceeds the €800 limit (€950 requested)");
  });

  it("unknown mandate → BLOCK", () => {
    const p = { ...PROPOSAL_A, mandate_id: "m_404" };
    const { decision } = evaluatePayment(p, sign(p), BEFORE_EXPIRY);
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons).toContain("No mandate m_404 on file");
  });

  // Scenario H — an agent the bank does not trust can never move money.
  it("scenario H: unknown agent → BLOCK (not verified)", () => {
    const p = { ...PROPOSAL_A, agent_id: "agent_ghost" };
    const { decision, agent_check } = evaluatePayment(p, sign(p), BEFORE_EXPIRY);
    expect(decision.outcome).toBe("BLOCK");
    expect(agent_check.pass).toBe(false);
    expect(decision.reasons.some((r) => r.includes("not in the bank's registry"))).toBe(true);
  });

  it("scenario H: wrong agent key → BLOCK (signature invalid)", () => {
    const wrong = generateKeys();
    const { decision } = evaluatePayment(PROPOSAL_A, signCanonical(PROPOSAL_A, wrong.privateKey), BEFORE_EXPIRY);
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons.some((r) => r.includes("signature is invalid"))).toBe(true);
  });

  it("scenario F: payment after revoke → BLOCK", () => {
    expect(evaluatePayment(PROPOSAL_A, sign(PROPOSAL_A), BEFORE_EXPIRY).decision.outcome).toBe("EXECUTE");
    revokeMandate("m_001");
    const { decision } = evaluatePayment(PROPOSAL_A, sign(PROPOSAL_A), BEFORE_EXPIRY);
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons).toContain("Mandate has been revoked by the customer");
  });
});
