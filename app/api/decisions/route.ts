import { connection } from "next/server";
import { countByOutcome, listDecisions } from "@/lib/decisions";

// The feed the Risk Officer Console polls: every decision, newest first, plus outcome counters.
export async function GET() {
  await connection(); // live in-memory state, never prerender
  return Response.json({ decisions: listDecisions(), counts: countByOutcome() });
}
