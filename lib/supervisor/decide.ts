import type { AgentCheck } from "../agents";
import type { MandateCheck } from "./mandate";
import { applyPolicy, type Policy } from "./policy";
import type { Score } from "./signals";

// The decision is plain, deterministic code. The LLM never decides whether money moves.
// Order matters: the hard gates (agent + mandate) run first and any failure is an absolute BLOCK.
// Only if they pass do the behavior/context scores get a say, and they can only TIGHTEN the outcome
// (VERIFY / ASK_HUMAN / BLOCK) — they can never turn a hard failure into anything but BLOCK.

export const OUTCOMES = ["EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Decision = { outcome: Outcome; reasons: string[] };

export type DecisionInput = {
  mandate: MandateCheck;
  agent?: AgentCheck;
  behavior?: Score;
  context?: Score;
  policy?: Policy;
};

const EMPTY: Score = { total: 0, signals: [] };

export function decide(input: DecisionInput): Decision {
  // Hard gates. A failure here is BLOCK no matter what the scores say.
  const hardFailures = [
    ...(input.agent && !input.agent.pass ? input.agent.failures.map((f) => f.message) : []),
    ...(!input.mandate.pass ? input.mandate.failures.map((f) => f.message) : []),
  ];
  if (hardFailures.length > 0) return { outcome: "BLOCK", reasons: hardFailures };

  // Soft tightening from behavior/context.
  return applyPolicy(input.behavior ?? EMPTY, input.context ?? EMPTY, input.policy);
}
