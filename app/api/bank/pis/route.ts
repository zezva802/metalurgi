import { connection } from "next/server";
import { z } from "zod";
import { executePayment, listPayments } from "@/lib/bank";

// Mock Open Banking PIS. Executes only payments the gateway has authorized.

const Body = z.object({ proposal_id: z.string().min(1) });

export async function GET() {
  await connection();
  return Response.json({ payments: listPayments() });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Body must be { proposal_id }" }, { status: 400 });
  }
  const result = executePayment(parsed.data.proposal_id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 403 });
  }
  return Response.json({ payment_id: result.payment.payment_id, status: result.payment.status });
}
