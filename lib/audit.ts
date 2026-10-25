import type { DecisionRecord } from "./decisions";
import type { Outcome } from "./supervisor/decide";

// S7: the audit view of a decision — a flat, self-contained row that stays meaningful after a
// restart (it carries the mandate hash and amounts, not a reference to in-memory state).

export type AuditEntry = {
  id: number;
  time: string;
  mandate_id: string;
  mandate_hash: string | null;
  agent_id: string;
  merchant: string;
  amount: number;
  currency: string;
  behavior: number;
  context: number;
  outcome: Outcome;
  reasons: string[];
  approver: string | null;
  latency_ms: number;
};

// Defensive against older rows persisted before latency_ms / mandate_hash existed (schema drift in a
// long-lived audit file): default anything missing rather than crash the page.
export function toAuditEntry(r: DecisionRecord): AuditEntry {
  return {
    id: r.id,
    time: r.decided_at,
    mandate_id: r.proposal.mandate_id,
    mandate_hash: r.result.mandate_hash ?? null,
    agent_id: r.proposal.agent_id,
    merchant: r.proposal.merchant,
    amount: r.proposal.amount,
    currency: r.proposal.currency,
    behavior: r.result.behavior?.total ?? 0,
    context: r.result.context?.total ?? 0,
    outcome: r.result.decision.outcome,
    reasons: r.result.decision.reasons,
    approver: r.resolution?.by ?? null,
    latency_ms: r.result.latency_ms ?? 0,
  };
}
