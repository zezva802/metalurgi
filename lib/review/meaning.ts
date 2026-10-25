import { geminiClient, GEMINI_MODEL, hasLlm } from "../gemini";
import type { Meaning } from "./types";

// The ONE bounded "meaning" call each specialist is allowed. Deterministic code has already
// established the facts; the model only interprets them. Runs keyless: without GEMINI_API_KEY we
// return the specialist's deterministic heuristic, so the whole review still works offline. The
// model never decides the verdict — it only labels aligned / mismatch / unclear with a rationale.

export function hasMeaningLlm(): boolean {
  return hasLlm();
}

const SYSTEM = `You are ONE check in a bank's agent-supervision pipeline. Deterministic code already established the facts in the evidence. Answer ONLY the meaning question — do not re-derive the facts and do not decide the overall outcome. Reply as strict JSON: {"judgment":"aligned|mismatch|unclear","rationale":"one short sentence"}.`;

export async function assessMeaning(question: string, evidence: Record<string, unknown>, fallback: Meaning): Promise<Meaning> {
  if (!hasLlm()) return fallback;
  try {
    const response = await geminiClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Question: ${question}\n\nEvidence:\n${JSON.stringify(evidence, null, 2)}` },
      ],
    });
    const text = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const judgment = ["aligned", "mismatch", "unclear"].includes(parsed.judgment) ? parsed.judgment : "unclear";
    return { judgment, rationale: String(parsed.rationale ?? ""), source: "llm" };
  } catch {
    return fallback;
  }
}
