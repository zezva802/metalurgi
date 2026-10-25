import type { GatewayResult } from "./gateway";
import type { Proposal } from "./supervisor/proposal";
import type { Outcome } from "./supervisor/decide";

// Every decision the gateway makes is recorded here so the Risk Officer Console (S4) and the audit
// log (S7) can show it. In-memory for now; S7 persists it. Kept on globalThis to survive hot reloads.

export type DecisionRecord = {
  id: number;
  decided_at: string;
  proposal: Proposal;
  result: GatewayResult;
};

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
