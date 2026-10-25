import { revokeMandate } from "@/lib/store";

// The customer cancels a mandate. After this, any payment under it is a hard BLOCK (scenario F).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!revokeMandate(id)) {
    return Response.json({ errors: [`No mandate ${id} on file`] }, { status: 404 });
  }
  return Response.json({ mandate_id: id, revoked: true });
}
