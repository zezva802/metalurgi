import { authorizePayment, executePayment, type Payment } from "./bank";
import { recordExecution } from "./store";
import type { GatewayResult } from "./gateway";
import type { Proposal } from "./supervisor/proposal";
import type { Outcome } from "./supervisor/decide";

// Every decision the gateway makes is recorded here so the Risk Officer Console (S4) and the audit
// log (S7) can show it. In-memory for now; S7 persists it. Kept on globalThis to survive hot reloads.

// A VERIFY or ASK_HUMAN decision waits for a human. Approving it executes the payment (logging the
// approver); rejecting it leaves the money where it is. (S6)
export type Resolution = { status: "approved" | "rejected"; by: string; at: string; payment?: Payment };

export type DecisionRecord = {
  id: number;
  decided_at: string;
  proposal: Proposal;
  result: GatewayResult;
  resolution?: Resolution;
};

const PENDING_OUTCOMES: Outcome[] = ["VERIFY", "ASK_HUMAN"];

type Log = { records: DecisionRecord[]; next: number };

const g = globalThis as typeof globalThis & { __metalurgiDecisions?: Log };
const log: Log = (g.__metalurgiDecisions ??= { records: [], next: 1 });

export function recordDecision(proposal: Proposal, result: GatewayResult, now = new Date()): DecisionRecord {
  const record: DecisionRecord = { id: log.next++, decided_at: now.toISOString(), proposal, result };
  log.records.push(record);
  return record;
}

export function listDecisions(): DecisionRecord[] {
  return [...log.records].reverse(); // newest first
}

export function resetDecisions(): void {
  log.records = [];
  log.next = 1;
}

export type OutcomeCounts = Record<Outcome, number>;

export function countByOutcome(): OutcomeCounts {
  const counts: OutcomeCounts = { EXECUTE: 0, VERIFY: 0, ASK_HUMAN: 0, BLOCK: 0 };
  for (const r of log.records) counts[r.result.decision.outcome]++;
  return counts;
}

// Decisions a human still has to act on: VERIFY/ASK_HUMAN that haven't been approved or rejected.
export function listPending(): DecisionRecord[] {
  return listDecisions().filter((r) => !r.resolution && PENDING_OUTCOMES.includes(r.result.decision.outcome));
}

export type ResolveResult = { ok: true; record: DecisionRecord } | { ok: false; error: string };

// A human approves or rejects a pending decision. Approve goes through the same bank path as an
// EXECUTE — authorize (logging the approver), execute, record usage — so a mandate's budget and
// use count move only after money actually moves.
export function resolveDecision(id: number, status: Resolution["status"], by: string, now = new Date()): ResolveResult {
  const record = log.records.find((r) => r.id === id);
  if (!record) return { ok: false, error: `No decision ${id}` };
  if (record.resolution) return { ok: false, error: `Decision ${id} is already ${record.resolution.status}` };
  if (!PENDING_OUTCOMES.includes(record.result.decision.outcome)) {
    return { ok: false, error: `Decision ${id} (${record.result.decision.outcome}) is not awaiting approval` };
  }

  if (status === "rejected") {
    record.resolution = { status, by, at: now.toISOString() };
    return { ok: true, record };
  }

  const p = record.proposal;
  authorizePayment({
    proposal_id: p.proposal_id,
    mandate_id: p.mandate_id,
    merchant: p.merchant,
    amount: p.amount,
    currency: p.currency,
    authorized_by: `approver:${by}`,
  });
  const executed = executePayment(p.proposal_id, now);
  if (!executed.ok) return { ok: false, error: executed.error };
  recordExecution(p.mandate_id, p.amount);
  record.resolution = { status, by, at: now.toISOString(), payment: executed.payment };
  return { ok: true, record };
}
