import OpenAI from "openai";

// Single place the app talks to the LLM. We use Gemini via its OpenAI-compatible endpoint, so the
// stable `openai` client works unchanged. Keyless by design: callers fall back to deterministic
// behaviour when GEMINI_API_KEY is absent, and the model never casts a verdict or moves money.

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

// Which Gemini model to use. Default is the "latest flash" alias so it tracks the current model and
// won't go stale; override with GEMINI_MODEL for a pinned id (e.g. gemini-2.5-flash, gemini-3.8-flash).
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export function hasLlm(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: BASE_URL });
}
