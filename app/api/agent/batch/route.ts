import { runBatch } from "@/lib/batch";

// A8: run a 200-payment batch (20 bad) through the gateway. Every decision lands in the console
// and the audit log, so the counters visibly move.
export async function POST() {
  try {
    return Response.json(runBatch());
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }
}
