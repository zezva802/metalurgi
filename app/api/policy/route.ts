import { connection } from "next/server";
import { z } from "zod";
import { getPolicy, resetPolicy, setPolicy } from "@/lib/supervisor/policy";

// S9: read and tune the live decision thresholds from the console. In-memory only.
export async function GET() {
  await connection();
  return Response.json(getPolicy());
}

const Body = z.object({
  contextBlock: z.number().min(0).max(100).optional(),
  contextVerify: z.number().min(0).max(100).optional(),
  behaviorAsk: z.number().min(0).max(100).optional(),
  reset: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be partial policy numbers 0–100, or { reset: true }"] }, { status: 400 });
  }
  const { reset, ...patch } = parsed.data;
  return Response.json(reset ? resetPolicy() : setPolicy(patch));
}
