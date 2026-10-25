// Entity-level agent review (docs/VISION.md). A bank submits a dossier of an agent's recent runs;
// 11 specialists each establish deterministic facts and make one bounded "meaning" call; the review
// applies the rule-book, checks hard gates, and recommends a verdict a human signs off.

export type Severity = "hard" | "high" | "medium" | "low";

// One past run the firm submits as evidence. No live crypto here — this is reported evidence.
export type AgentRun = {
  run_id: string;
  clean: boolean; // firm-reported: did this run complete with no issue (used for the clean-run ratio)
  human_request: string; // what the human actually asked for
  consent: { amount_cap: number; category: string; city: string } | null; // SCA/consent screen (null = not submitted)
  model: string; // which LLM the agent used
  prompt_excerpt: string;
  tool_calls: { tool: string; args: Record<string, unknown> }[];
  controls: { control: string; fired: boolean; overridden: boolean }[];
  signature: string; // present/absent marker (empty = missing)
  // the booking the agent made + the mandate it was under
  merchant: string;
  category: string;
  city: string;
  amount: number;
  currency: string;
  refundable: boolean;
  mandate_cap: number;
  mandate_category: string;
  mandate_city: string;
  executed: boolean;
};

export type Dossier = { agent_id: string; operator: string; status: string; runs: AgentRun[] };

export type Rule = { id: string; specialist: string; label: string; severity: Severity; enabled: boolean };
export type Thresholds = { minRuns: number; cleanRunRatioAuthorise: number; cleanRunRatioMonitor: number; concentrationPct: number };
export type RuleBook = { thresholds: Thresholds; rules: Rule[] };

export type Fact = { rule_id: string; ok: boolean; detail: string };
export type Meaning = { judgment: "aligned" | "mismatch" | "unclear"; rationale: string; source: "llm" | "heuristic" };

// What a specialist produces deterministically (before the meaning call is attached).
export type SpecialistResult = {
  name: string;
  question: string; // the single meaning question
  facts: Fact[];
  evidence: Record<string, unknown>; // the grounding passed to the meaning call
  heuristic: Meaning; // keyless fallback for the meaning call
};

export type Issue = { rule_id: string; label: string; severity: Severity; detail: string };

export type SpecialistFinding = {
  name: string;
  question: string;
  facts: Fact[];
  issues: Issue[];
  hard_gate: boolean;
  verdict: "pass" | "concern" | "fail";
  meaning: Meaning;
};

export type EntityVerdict = "AUTHORISE" | "MONITOR" | "REFUSE" | "INCOMPLETE";

export type EntityReview = {
  agent_id: string;
  operator: string;
  runs_total: number;
  runs_clean: number;
  verdict: EntityVerdict;
  reasons: string[];
  findings: SpecialistFinding[];
  // Machine-readable reporting schema: every rule, annotated with the failure it detects + its result.
  schema: { rule_id: string; specialist: string; label: string; severity: Severity; passed: boolean }[];
  signed_off_by: string | null;
  generated_at: string;
};
