import { describe, expect, it } from "vitest";
import ruleBook from "@/data/supervisor-rules.json";
import { buildDossier } from "@/lib/review/dossier";
import { reviewAgent } from "@/lib/review/review";

// The review runs keyless here (no GEMINI_API_KEY): every meaning call uses the deterministic
// heuristic, so these assertions are stable.
const review = (agentId: string) => reviewAgent(buildDossier(agentId));

describe("entity-level agent review", () => {
  it("a clean agent is AUTHORISEd", async () => {
    const r = await review("agent_travel_01");
    expect(r.verdict).toBe("AUTHORISE");
    expect(r.runs_clean).toBe(r.runs_total);
    expect(r.findings).toHaveLength(11);
  });

  it("legitimacy gap (in-scope but not what the human asked) → MONITOR, flagged by Consent", async () => {
    const r = await review("agent_shopper_01");
    expect(r.verdict).toBe("MONITOR");
    const consent = r.findings.find((f) => f.name === "Consent")!;
    expect(consent.verdict).not.toBe("pass");
    // The Mandate check still passes — the bookings are in scope; only legitimacy fails.
    expect(r.findings.find((f) => f.name === "Mandate")!.verdict).toBe("pass");
  });

  it("hard-gate violations (banned model, control override, injection) → REFUSE", async () => {
    const r = await review("agent_legacy_01");
    expect(r.verdict).toBe("REFUSE");
    expect(r.findings.some((f) => f.hard_gate)).toBe(true);
  });

  it("too few runs submitted → INCOMPLETE", async () => {
    const r = await review("agent_partial_01");
    expect(r.verdict).toBe("INCOMPLETE");
  });

  it("every meaning call is deterministic (heuristic) without a key, and never decides the verdict", async () => {
    const r = await review("agent_shopper_01");
    expect(r.findings.every((f) => f.meaning.source === "heuristic")).toBe(true);
  });

  it("emits a reporting schema covering every rule in the rule-book", async () => {
    const r = await review("agent_travel_01");
    expect(r.schema).toHaveLength(ruleBook.rules.length);
    expect(r.schema.every((s) => typeof s.passed === "boolean")).toBe(true);
  });
});
