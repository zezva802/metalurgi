import { signProposalAs } from "@/lib/agent/sign";
import { evaluatePayment } from "@/lib/gateway";
import { ProposalSchema } from "@/lib/supervisor/proposal";

// Temporary dev helper (S3/E5). The browser test form can't hold an agent's private key, so the
// server signs the proposal as the named agent and runs it through the gateway. Real agents (A4/A6)
// sign themselves and POST { proposal, signature } to /api/payments directly.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Body must be valid JSON"] }, { status: 400 });
  }

  const parsed = ProposalSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join(".") || "proposal"}: ${i.message}`);
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const signature = signProposalAs(parsed.data.agent_id, parsed.data);
    return Response.json(evaluatePayment(parsed.data, signature));
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }
}
