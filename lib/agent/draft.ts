import Anthropic from "@anthropic-ai/sdk";
import { MANDATE_TEMPLATE } from "../mandates";
import { MandateSchema } from "../supervisor/mandate";
import { hasLlm } from "./llm";

// A5: turn Nino's plain-language request into a mandate draft she can review before signing. The LLM
// fills the fields; we zod-validate the result and fall back to the editable template on any failure
// (no key, bad JSON, invalid mandate). Either way the editor ends up with a valid starting mandate.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export type DraftResult = { draft: object; source: "llm" | "template"; note?: string };

const SYSTEM = `Convert the user's request into a hotel mandate as strict JSON with exactly these fields:
agent_id (use "agent_travel_01"), category ("hotel"), city, dates {from, to} as YYYY-MM-DD,
max_amount (number), currency (3-letter, e.g. EUR), max_uses (integer >=1),
preferences {refundable: boolean}, expires_at (ISO 8601).
Reply with ONLY the JSON object, no prose.`;

// Validate the LLM's draft the same way createMandate will: fill the server-set fields, parse, and
// check dates are ordered. Returns the parsed mandate fields (minus the server-set ones) or null.
function validate(parsed: unknown): object | null {
  const base = typeof parsed === "object" && parsed !== null ? parsed : {};
  const result = MandateSchema.safeParse({ ...base, mandate_id: "pending", principal_id: "nino" });
  if (!result.success) return null;
  const m = result.data;
  if (m.dates.from > m.dates.to) return null;
  // Return only the editable fields; the server sets mandate_id and principal_id when signing.
  return {
    agent_id: m.agent_id,
    category: m.category,
    city: m.city,
    dates: m.dates,
    max_amount: m.max_amount,
    currency: m.currency,
    max_uses: m.max_uses,
    preferences: m.preferences,
    expires_at: m.expires_at,
  };
}

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

export async function draftMandate(request: string): Promise<DraftResult> {
  if (!hasLlm()) {
    return { draft: MANDATE_TEMPLATE, source: "template", note: "Set ANTHROPIC_API_KEY to draft with AI. Showing the template." };
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: request }],
    });
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const draft = validate(firstJsonObject(text));
    if (!draft) return { draft: MANDATE_TEMPLATE, source: "template", note: "The AI draft was not a valid mandate. Showing the template." };
    return { draft, source: "llm" };
  } catch {
    return { draft: MANDATE_TEMPLATE, source: "template", note: "The AI draft failed. Showing the template." };
  }
}
