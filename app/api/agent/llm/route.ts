import { z } from "zod";
import { runLlmAgent } from "@/lib/agent/llm";

// A4: run the live LLM travel agent for one request against one mandate.
const Body = z.object({ request: z.string().min(1), mandate_id: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be { request, mandate_id }"] }, { status: 400 });
  }
  try {
    return Response.json(await runLlmAgent(parsed.data.request, parsed.data.mandate_id));
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 503 });
  }
}
