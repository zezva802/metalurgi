import Anthropic from "@anthropic-ai/sdk";
import type { GatewayResult } from "../gateway";
import { compareOffers, proposePayment, searchHotels } from "./tools";

// A4: the live LLM travel agent. It plans with three tools (search_hotels, compare_offers,
// propose_payment) and we log every tool call so the run is fully visible. The LLM never decides
// whether money moves — propose_payment just submits to the gateway, which makes the real decision.
// Needs ANTHROPIC_API_KEY (.env.local). Without it we throw and the UI points at the scripted agent.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export function hasLlm(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ToolCall = { tool: string; input: unknown; output: unknown };
export type AgentRun = { request: string; log: ToolCall[]; result?: GatewayResult; message: string };

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_hotels",
    description: "Find hotel offers in a city for given dates. Returns offers with merchant, price and refundability.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string" },
        from: { type: "string", description: "check-in YYYY-MM-DD" },
        to: { type: "string", description: "check-out YYYY-MM-DD" },
      },
      required: ["city"],
    },
  },
  {
    name: "compare_offers",
    description: "Compare offers against the market median for the same hotel. Use this to shop around before paying.",
    input_schema: {
      type: "object",
      properties: {
        offer_ids: { type: "array", items: { type: "string" } },
        city: { type: "string" },
      },
    },
  },
  {
    name: "propose_payment",
    description: "Submit a chosen offer to the bank gateway for a decision. options_compared is how many offers you looked at.",
    input_schema: {
      type: "object",
      properties: {
        mandate_id: { type: "string" },
        offer_id: { type: "string" },
        options_compared: { type: "integer" },
      },
      required: ["mandate_id", "offer_id", "options_compared"],
    },
  },
];

const SYSTEM = `You are Nino's travel booking agent. Book a hotel that fits her mandate: search, compare a few options against the market, then propose payment for the best refundable, fairly-priced offer on a trusted platform. Always compare before you propose. You never decide whether the payment is allowed — the bank gateway does.`;

function runTool(name: string, input: Record<string, unknown>, mandateId: string): { output: unknown; isError: boolean; result?: GatewayResult } {
  switch (name) {
    case "search_hotels":
      return { output: searchHotels(input as { city: string; from?: string; to?: string }), isError: false };
    case "compare_offers":
      return { output: compareOffers(input as { offer_ids?: string[]; city?: string }), isError: false };
    case "propose_payment": {
      const res = proposePayment({
        mandate_id: (input.mandate_id as string) || mandateId,
        offer_id: input.offer_id as string,
        options_compared: Number(input.options_compared ?? 0),
      });
      if (!res.ok) return { output: { error: res.error }, isError: true };
      return { output: { outcome: res.result.decision.outcome, reasons: res.result.decision.reasons }, isError: false, result: res.result };
    }
    default:
      return { output: { error: `Unknown tool ${name}` }, isError: true };
  }
}

export async function runLlmAgent(request: string, mandateId: string, onToolCall?: (call: ToolCall) => void): Promise<AgentRun> {
  if (!hasLlm()) {
    throw new Error("The live LLM agent needs ANTHROPIC_API_KEY in .env.local. Use the scripted agent instead.");
  }

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `${request}\n\nUse mandate ${mandateId}.` }];
  const log: ToolCall[] = [];
  let result: GatewayResult | undefined;

  for (let step = 0; step < 8; step++) {
    const response = await client.messages.create({ model: MODEL, max_tokens: 2048, system: SYSTEM, tools: TOOLS, messages });
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ");
      return { request, log, result, message: text || "Agent finished without a proposal." };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      const ran = runTool(call.name, call.input as Record<string, unknown>, mandateId);
      const entry: ToolCall = { tool: call.name, input: call.input, output: ran.output };
      log.push(entry);
      onToolCall?.(entry); // A7: stream each tool call to the UI as it happens
      if (ran.result) result = ran.result;
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(ran.output), is_error: ran.isError });
    }
    messages.push({ role: "user", content: toolResults });

    if (result) {
      return { request, log, result, message: `Gateway decision: ${result.decision.outcome}` };
    }
  }

  return { request, log, result, message: "Agent stopped after 8 steps without a decision." };
}
