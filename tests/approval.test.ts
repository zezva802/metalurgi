import { beforeEach, describe, expect, it } from "vitest";
import { listPayments, resetBank } from "@/lib/bank";
import { listPending, recordDecision, resetDecisions, resolveDecision } from "@/lib/decisions";
import { getUsage, resetStore } from "@/lib/store";
import type { GatewayResult } from "@/lib/gateway";
import type { Outcome } from "@/lib/supervisor/decide";
import { PROPOSAL_A } from "./fixtures";

// Build a pending decision record directly, without running the whole gateway.
function pending(outcome: Outcome, proposal = { ...PROPOSAL_A, proposal_id: "p_pending" }) {
  const result: GatewayResult = {
    proposal_id: proposal.proposal_id,
    mandate_id: proposal.mandate_id,
    decision: { outcome, reasons: ["needs a human"] },
    agent_check: { pass: true, failures: [] },
    mandate_check: { pass: true, failures: [] },
    behavior: { total: 0, signals: [] },
    context: { total: 60, signals: [] },
  };
  return recordDecision(proposal, result);
}

beforeEach(() => {
  resetStore();
  resetBank();
  resetDecisions();
});

describe("approval queue (S6)", () => {
  it("lists VERIFY and ASK_HUMAN as pending, not EXECUTE/BLOCK", () => {
    pending("VERIFY", { ...PROPOSAL_A, proposal_id: "p_v" });
    pending("ASK_HUMAN", { ...PROPOSAL_A, proposal_id: "p_a" });
    pending("EXECUTE", { ...PROPOSAL_A, proposal_id: "p_e" });
    expect(listPending().map((d) => d.proposal.proposal_id).sort()).toEqual(["p_a", "p_v"]);
  });

  it("approving executes the payment at the bank and records usage", () => {
    const record = pending("ASK_HUMAN");
    const result = resolveDecision(record.id, "approved", "Nino");
    expect(result.ok).toBe(true);
    expect(listPayments()).toHaveLength(1);
    expect(listPayments()[0].authorized_by).toBe("approver:Nino");
    expect(getUsage(PROPOSAL_A.mandate_id).uses).toBe(1);
    expect(listPending()).toHaveLength(0);
  });

  it("rejecting moves no money and clears it from the queue", () => {
    const record = pending("VERIFY");
    const result = resolveDecision(record.id, "rejected", "Nino");
    expect(result.ok).toBe(true);
    expect(listPayments()).toHaveLength(0);
    expect(getUsage(PROPOSAL_A.mandate_id).uses).toBe(0);
    expect(listPending()).toHaveLength(0);
  });

  it("a decision cannot be resolved twice", () => {
    const record = pending("VERIFY");
    expect(resolveDecision(record.id, "approved", "Nino").ok).toBe(true);
    const second = resolveDecision(record.id, "approved", "Nino");
    expect(second.ok).toBe(false);
  });
});
