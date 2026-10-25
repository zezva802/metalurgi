// A9: final acceptance run. Scenarios A–H three times, each from a clean start, then the
// key-removed fallbacks. No API key needed — the scripted scenarios are deterministic TypeScript.
// Run: npm run finalrun
import { resetBank } from "../lib/bank";
import { resetDecisions } from "../lib/decisions";
import { resetStore } from "../lib/store";
import { runScenario, SCENARIOS, type ScenarioId } from "../lib/agent/scripted";
import { draftMandate } from "../lib/agent/draft";
import { hasLlm, runLlmAgent } from "../lib/agent/llm";

// A9 explicitly covers "with the LLM key removed" — force that regardless of the environment.
delete process.env.GEMINI_API_KEY;

const IDS = Object.keys(SCENARIOS) as ScenarioId[];

async function main() {
  let failures = 0;

  for (let pass = 1; pass <= 3; pass++) {
    // Clean start: wipe the in-memory store, bank and decision log.
    resetStore();
    resetBank();
    resetDecisions();
    console.log(`\nPass ${pass} (clean start)`);
    for (const id of IDS) {
      const expected = SCENARIOS[id].expected;
      const actual = runScenario(id).outcomes.map((o) => o.decision.outcome).join(" then ");
      const ok = actual === expected;
      if (!ok) failures++;
      console.log(`  ${id}  ${ok ? "OK  " : "FAIL"}  expected ${expected.padEnd(18)} actual ${actual}`);
    }
  }

  console.log(`\nWith the LLM key removed (hasLlm=${hasLlm()}):`);
  const draft = await draftMandate("Book a refundable Paris hotel 20–23 Sep up to €800");
  const draftOk = draft.source === "template";
  if (!draftOk) failures++;
  console.log(`  draftMandate falls back to the template: ${draftOk ? "OK" : "FAIL"} (source=${draft.source})`);

  let threw = false;
  try {
    await runLlmAgent("Book Nino's Paris hotel", "m_001");
  } catch {
    threw = true;
  }
  if (!threw) failures++;
  console.log(`  live agent declines without a key: ${threw ? "OK" : "FAIL"}`);

  console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"} — A–H x3 + key-removed fallbacks`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
