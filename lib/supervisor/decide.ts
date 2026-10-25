import type { AgentCheck } from "../agents";
import type { MandateCheck } from "./mandate";

// The decision is plain, deterministic code. The LLM never decides whether money moves.
// Hard gates (agent + mandate) failing → BLOCK, listing every reason. E10 adds behavior and
// context scores, which may only tighten the outcome, never loosen a BLOCK from a hard gate.

export const OUTCOMES = ["EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Decision = { outcome: Outcome; reasons: string[] };

export type DecisionInput = { mandate: MandateCheck; agent?: AgentCheck };

export function decide(input: DecisionInput): Decision {
  const reasons: string[] = [];
  if (input.agent && !input.agent.pass) reasons.push(...input.agent.failures.map((f) => f.message));
  if (!input.mandate.pass) reasons.push(...input.mandate.failures.map((f) => f.message));

  if (reasons.length > 0) return { outcome: "BLOCK", reasons };
  return { outcome: "EXECUTE", reasons: ["All mandate rules passed"] };
}
