import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetBank } from "@/lib/bank";
import { evaluatePayment } from "@/lib/gateway";
import { resetStore, revokeMandate, saveMandate } from "@/lib/store";
import { decide } from "@/lib/supervisor/decide";
import { generateKeys, signCanonical } from "@/lib/supervisor/mandate";
import type { Proposal } from "@/lib/supervisor/proposal";
import { BEFORE_EXPIRY, MANDATE, PROPOSAL_A } from "./fixtures";

// End-to-end demo scenarios (docs/CLAUDE.md). The gateway output must match the table exactly.
const nino = generateKeys();
const agent = generateKeys();
vi.mock("@/lib/keys", () => ({
  loadPublicKey: (id: string) => (id === "nino" ? nino.publicKey : agent.publicKey),
}));

beforeEach(() => {
  resetStore();
  resetBank();
  saveMandate({ mandate: MANDATE, signature: signCanonical(MANDATE, nino.privateKey), signed_at: "2026-09-01T09:00:00Z" });
});

// Run a proposal (PROPOSAL_A with overrides) through the gateway, signed by the agent by default.
function run(overrides: Partial<Proposal>, signWith = agent.privateKey) {
  const proposal: Proposal = { ...PROPOSAL_A, ...overrides };
  return evaluatePayment(proposal, signCanonical(proposal, signWith), BEFORE_EXPIRY);
}

describe("demo scenarios A–H", () => {
  it("A: €540 refundable, known platform, 6 options → EXECUTE", () => {
    expect(run({ proposal_id: "p_a" }).decision.outcome).toBe("EXECUTE");
  });

  it("B: €760 non-refundable, known platform → ASK_HUMAN", () => {
    const { decision } = run({ proposal_id: "p_b", merchant: "staywell.example", amount: 760, refundable: false, options_compared: 6 });
    expect(decision.outcome).toBe("ASK_HUMAN");
    expect(decision.reasons.join(" ")).toMatch(/refundable/i);
  });

  it("C: €610 unknown site 4 days old, 45% below market, 1 option → VERIFY", () => {
    const { decision, context } = run({ proposal_id: "p_c", merchant: "paris-hotels-deal.shop", amount: 610, options_compared: 1 });
    expect(decision.outcome).toBe("VERIFY");
    expect(context.signals).toHaveLength(3);
  });

  it("D: €950 → BLOCK (exceeds the €800 limit)", () => {
    const { decision } = run({ proposal_id: "p_d", amount: 950 });
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons.some((r) => r.includes("Exceeds the €800 limit"))).toBe(true);
  });

  it("E: mandate edited to €2,000 after signing → BLOCK (signature invalid)", () => {
    resetStore();
    // Stored mandate says €2,000 but the signature is over the original €800 mandate.
    saveMandate({ mandate: { ...MANDATE, max_amount: 2000 }, signature: signCanonical(MANDATE, nino.privateKey), signed_at: "x" });
    const { decision } = run({ proposal_id: "p_e", amount: 1500 });
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons.some((r) => r.toLowerCase().includes("signature"))).toBe(true);
  });

  it("F: payment after the mandate is revoked → BLOCK", () => {
    revokeMandate("m_001");
    const { decision } = run({ proposal_id: "p_f" });
    expect(decision.outcome).toBe("BLOCK");
    expect(decision.reasons).toContain("Mandate has been revoked by the customer");
  });

  it("G: two €475 payments on a single-use mandate → 1st EXECUTE, 2nd BLOCK", () => {
    expect(run({ proposal_id: "p_g1", amount: 475 }).decision.outcome).toBe("EXECUTE");
    expect(run({ proposal_id: "p_g2", amount: 475 }).decision.outcome).toBe("BLOCK");
  });

  it("H: unknown agent → BLOCK", () => {
    expect(run({ proposal_id: "p_h", agent_id: "agent_ghost" }).decision.outcome).toBe("BLOCK");
  });

  it("H: wrong agent key → BLOCK", () => {
    expect(run({ proposal_id: "p_h2" }, generateKeys().privateKey).decision.outcome).toBe("BLOCK");
  });
});

describe("guardrail: behavior/context can only tighten, never loosen a hard failure", () => {
  it("a mandate failure stays BLOCK even when both scores are zero", () => {
    const decision = decide({
      mandate: { pass: false, failures: [{ rule: "max_amount", message: "Exceeds the €800 limit" }] },
      behavior: { total: 0, signals: [] },
      context: { total: 0, signals: [] },
    });
    expect(decision.outcome).toBe("BLOCK");
  });

  it("an agent failure stays BLOCK even with a clean mandate and low scores", () => {
    const decision = decide({
      mandate: { pass: true, failures: [] },
      agent: { pass: false, failures: [{ rule: "signature", message: "bad sig" }] },
      behavior: { total: 0, signals: [] },
      context: { total: 0, signals: [] },
    });
    expect(decision.outcome).toBe("BLOCK");
  });
});
