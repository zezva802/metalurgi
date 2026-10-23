import { connection } from "next/server";
import { loadPrivateKey } from "@/lib/keys";
import { createMandate, PRINCIPAL_ID } from "@/lib/mandates";
import { listMandates } from "@/lib/store";

export async function GET() {
  await connection(); // reads live in-memory state, never prerender
  return Response.json({ mandates: listMandates() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["Body must be valid JSON"] }, { status: 400 });
  }

  let privateKey;
  try {
    privateKey = loadPrivateKey(PRINCIPAL_ID);
  } catch (error) {
    return Response.json({ errors: [(error as Error).message] }, { status: 500 });
  }

  const result = createMandate(body, privateKey);
  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }
  return Response.json(result.entry, { status: 201 });
}
