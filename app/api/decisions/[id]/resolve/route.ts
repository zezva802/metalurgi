import { z } from "zod";
import { resolveDecision } from "@/lib/decisions";

// A human (Nino, in the bank app) approves or rejects a pending VERIFY/ASK_HUMAN decision.
const Body = z.object({ action: z.enum(["approve", "reject"]), approver: z.string().min(1).default("Nino") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be { action: 'approve' | 'reject', approver? }"] }, { status: 400 });
  }

  const status = parsed.data.action === "approve" ? "approved" : "rejected";
  const result = resolveDecision(Number(id), status, parsed.data.approver);
  if (!result.ok) {
    return Response.json({ errors: [result.error] }, { status: 400 });
  }
  return Response.json(result.record);
}
