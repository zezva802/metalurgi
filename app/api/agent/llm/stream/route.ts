import { z } from "zod";
import { runLlmAgent } from "@/lib/agent/llm";

// A7: run the live agent and stream each tool call as it happens (newline-delimited JSON), then a
// final "done" (or "error") line. The UI appends tool calls live instead of waiting for the end.
const Body = z.object({ request: z.string().min(1), mandate_id: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be { request, mandate_id }"] }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const run = await runLlmAgent(parsed.data.request, parsed.data.mandate_id, (call) => send({ type: "tool", call }));
        send({ type: "done", result: run.result ?? null, message: run.message });
      } catch (error) {
        send({ type: "error", message: (error as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
