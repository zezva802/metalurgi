import { evaluatePayment } from "@/lib/gateway";
import { ProposalSchema } from "@/lib/supervisor/proposal";

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
    return Response.json(evaluatePayment(parsed.data));
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }
}
