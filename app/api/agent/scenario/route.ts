import { z } from "zod";
import { runScenario, type ScenarioId } from "@/lib/agent/scripted";

// A6: run one scripted demo scenario (A–H) through the gateway.
const Body = z.object({ scenario: z.enum(["A", "B", "C", "D", "E", "F", "G", "H"]) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be { scenario: 'A'..'H' }"] }, { status: 400 });
  }
  try {
    return Response.json(runScenario(parsed.data.scenario as ScenarioId));
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }
}
