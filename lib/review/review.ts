import ruleBookJson from "@/data/supervisor-rules.json";
import { assessMeaning } from "./meaning";
import { SPECIALISTS } from "./specialists";
import type { Dossier, EntityReview, EntityVerdict, Issue, Rule, RuleBook, SpecialistFinding } from "./types";

// Entity verdict: hard gates first (automatic refuse), then weigh the rest, then a human signs off.
// The decision is NOT a score — it's deterministic rules over the specialists' facts. The LLM only
// colours each specialist's "meaning"; it never casts this verdict.

const RULE_BOOK = ruleBookJson as RuleBook;
const RULES: Map<string, Rule> = new Map(RULE_BOOK.rules.map((r) => [r.id, r]));

export async function reviewAgent(dossier: Dossier, signedOffBy: string | null = null): Promise<EntityReview> {
  const { thresholds } = RULE_BOOK;
  const runsTotal = dossier.runs.length;
  const runsClean = dossier.runs.filter((r) => r.clean).length;
  const cleanRatio = runsTotal ? runsClean / runsTotal : 0;

  const findings: SpecialistFinding[] = [];
  for (const specialist of SPECIALISTS) {
    const result = specialist.run(dossier);

    const issues: Issue[] = [];
    for (const f of result.facts) {
      if (f.ok) continue;
      const rule = RULES.get(f.rule_id);
      if (!rule || !rule.enabled) continue; // a supervisor can disable a rule in the data file
      issues.push({ rule_id: rule.id, label: rule.label, severity: rule.severity, detail: f.detail });
    }

    const hard_gate = issues.some((i) => i.severity === "hard");
    const meaning = await assessMeaning(result.question, result.evidence, result.heuristic);
    const verdict: SpecialistFinding["verdict"] = hard_gate || issues.some((i) => i.severity === "high")
      ? "fail"
      : issues.length > 0 || meaning.judgment === "mismatch"
        ? "concern"
        : "pass";

    findings.push({ name: result.name, question: result.question, facts: result.facts, issues, hard_gate, verdict, meaning });
  }

  const hardIssues = findings.flatMap((f) => f.issues.filter((i) => i.severity === "hard"));
  const highIssues = findings.flatMap((f) => f.issues.filter((i) => i.severity === "high"));

  let verdict: EntityVerdict;
  const reasons: string[] = [];
  if (runsTotal < thresholds.minRuns) {
    verdict = "INCOMPLETE";
    reasons.push(`Only ${runsTotal} runs submitted; at least ${thresholds.minRuns} are required to assess the agent.`);
  } else if (hardIssues.length > 0) {
    verdict = "REFUSE";
    reasons.push(...dedupe(hardIssues.map((i) => i.label)));
  } else if (cleanRatio >= thresholds.cleanRunRatioAuthorise && highIssues.length === 0) {
    verdict = "AUTHORISE";
    reasons.push(`All checks passed; ${runsClean}/${runsTotal} runs clean.`);
  } else if (cleanRatio >= thresholds.cleanRunRatioMonitor) {
    verdict = "MONITOR";
    reasons.push(...dedupe([...highIssues, ...findings.flatMap((f) => f.issues)].map((i) => i.label)).slice(0, 4));
    if (reasons.length === 0) reasons.push(`${runsClean}/${runsTotal} runs clean — keep under watch.`);
  } else {
    verdict = "REFUSE";
    reasons.push(`Too many problem runs: only ${runsClean}/${runsTotal} were clean.`);
  }

  const schema = RULE_BOOK.rules.map((r) => ({
    rule_id: r.id,
    specialist: r.specialist,
    label: r.label,
    severity: r.severity,
    passed: !findings.some((f) => f.issues.some((i) => i.rule_id === r.id)),
  }));

  return {
    agent_id: dossier.agent_id,
    operator: dossier.operator,
    runs_total: runsTotal,
    runs_clean: runsClean,
    verdict,
    reasons,
    findings,
    schema,
    signed_off_by: signedOffBy,
    generated_at: new Date().toISOString(),
  };
}

const dedupe = (xs: string[]) => [...new Set(xs)];
