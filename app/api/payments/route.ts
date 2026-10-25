import { z } from "zod";
import { evaluatePayment } from "@/lib/gateway";
import { ProposalSchema } from "@/lib/supervisor/proposal";

// A real agent sends its proposal together with a detached Ed25519 signature over the proposal.
// The gateway verifies that signature against the agent registry before anything can move money.
const PaymentRequestSchema = z.object({ proposal: ProposalSchema, signature: z.string().min(1) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Body must be valid JSON"] }, { status: 400 });
  }

  const parsed = PaymentRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`);
    return Response.json({ errors }, { status: 400 });
  }

  try {
    return Response.json(evaluatePayment(parsed.data.proposal, parsed.data.signature));
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }
}
