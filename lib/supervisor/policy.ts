import policyJson from "@/data/policy.json";
import type { Outcome } from "./decide";
import type { Score } from "./signals";

// The soft part of the decision: behavior and context scores map to an outcome by thresholds.
// These thresholds live in data/policy.json so the console sliders (S9) can tune them in memory.
// Scores can only TIGHTEN — the hard gates in decide.ts run first and a hard failure is always BLOCK.

export type Policy = { contextBlock: number; contextVerify: number; behaviorAsk: number };

export const DEFAULT_POLICY: Policy = policyJson;

// The live policy is mutable in memory so the console sliders (S9) can tune thresholds without a
// restart. Kept on globalThis to survive hot reloads; resets to DEFAULT_POLICY on a real restart.
const g = globalThis as typeof globalThis & { __metalurgiPolicy?: Policy };

export function getPolicy(): Policy {
  return (g.__metalurgiPolicy ??= { ...DEFAULT_POLICY });
}

export function setPolicy(patch: Partial<Policy>): Policy {
  g.__metalurgiPolicy = { ...getPolicy(), ...patch };
  return g.__metalurgiPolicy;
}

export function resetPolicy(): Policy {
  g.__metalurgiPolicy = { ...DEFAULT_POLICY };
  return g.__metalurgiPolicy;
}

// Starting policy (docs/CLAUDE.md), tuned in E13:
//   context >= contextBlock  -> BLOCK   (external risk too high)
//   behavior >= behaviorAsk  -> ASK_HUMAN (unusual for Nino — a person should look)
//   context >= contextVerify -> VERIFY  (worth an extra confirmation step)
//   otherwise                -> EXECUTE
// ASK_HUMAN is checked before VERIFY so the more restrictive outcome wins when both apply.
export function applyPolicy(behavior: Score, context: Score, policy: Policy = getPolicy()): { outcome: Outcome; reasons: string[] } {
  if (context.total >= policy.contextBlock) {
    return { outcome: "BLOCK", reasons: topReasons(context, behavior) };
  }
  if (behavior.total >= policy.behaviorAsk) {
    return { outcome: "ASK_HUMAN", reasons: topReasons(behavior, context) };
  }
  if (context.total >= policy.contextVerify) {
    return { outcome: "VERIFY", reasons: topReasons(context, behavior) };
  }
  return { outcome: "EXECUTE", reasons: ["All checks passed and this looks normal for Nino"] };
}

// The two or three strongest signals, in plain words, so the console shows why — not raw numbers.
function topReasons(...scores: Score[]): string[] {
  const reasons = scores
    .flatMap((s) => s.signals)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((s) => s.explanation);
  return reasons.length > 0 ? reasons : ["Elevated risk score"];
}
