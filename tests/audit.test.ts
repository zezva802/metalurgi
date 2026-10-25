import { describe, expect, it } from "vitest";
import { toAuditEntry } from "@/lib/audit";
import type { DecisionRecord } from "@/lib/decisions";
import { PROPOSAL_A } from "./fixtures";

const record: DecisionRecord = {
  id: 7,
  decided_at: "2026-10-25T12:00:00.000Z",
  proposal: PROPOSAL_A,
  result: {
    proposal_id: PROPOSAL_A.proposal_id,
    mandate_id: PROPOSAL_A.mandate_id,
    decision: { outcome: "ASK_HUMAN", reasons: ["needs a human"] },
    agent_check: { pass: true, failures: [] },
    mandate_check: { pass: true, failures: [] },
    behavior: { total: 50, signals: [] },
    context: { total: 10, signals: [] },
    mandate_hash: "abc123",
    latency_ms: 0.42,
  },
  resolution: { status: "approved", by: "Nino", at: "2026-10-25T12:01:00.000Z" },
};

describe("toAuditEntry", () => {
  it("flattens a decision record into a self-contained audit row", () => {
    expect(toAuditEntry(record)).toEqual({
      id: 7,
      time: "2026-10-25T12:00:00.000Z",
      mandate_id: PROPOSAL_A.mandate_id,
      mandate_hash: "abc123",
      agent_id: PROPOSAL_A.agent_id,
      merchant: PROPOSAL_A.merchant,
      amount: PROPOSAL_A.amount,
      currency: PROPOSAL_A.currency,
      behavior: 50,
      context: 10,
      outcome: "ASK_HUMAN",
      reasons: ["needs a human"],
      approver: "Nino",
      latency_ms: 0.42,
    });
  });

  it("reports no approver when the decision was not resolved by a human", () => {
    const unresolved: DecisionRecord = { ...record, resolution: undefined };
    expect(toAuditEntry(unresolved).approver).toBeNull();
  });
});
