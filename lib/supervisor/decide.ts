import type { MandateCheck } from "./mandate";

// The decision is plain, deterministic code. The LLM never decides whether money moves.
// E4 stub: mandate failure → BLOCK, otherwise EXECUTE. E10 adds behavior and context scores,
// which may only tighten the outcome, never loosen a mandate BLOCK.

export const OUTCOMES = ["EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Decision = { outcome: Outcome; reasons: string[] };

export type DecisionInput = { mandate: MandateCheck };

export function decide(input: DecisionInput): Decision {
  if (!input.mandate.pass) {
    return { outcome: "BLOCK", reasons: input.mandate.failures.map((f) => f.message) };
  }
  return { outcome: "EXECUTE", reasons: ["All mandate rules passed"] };
}
