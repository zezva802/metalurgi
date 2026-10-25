import { z } from "zod";
import { buildDossier, REVIEW_AGENTS } from "@/lib/review/dossier";
import { reviewAgent } from "@/lib/review/review";

// Entity-level agent review (docs/VISION.md): build the agent's dossier and run the 11 specialists.
export async function GET() {
  return Response.json({ agents: REVIEW_AGENTS });
}

const Body = z.object({ agent_id: z.string().min(1), signed_off_by: z.string().min(1).optional() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be { agent_id, signed_off_by? }"] }, { status: 400 });
  }
  try {
    const dossier = buildDossier(parsed.data.agent_id);
    return Response.json(await reviewAgent(dossier, parsed.data.signed_off_by ?? null));
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }
}
