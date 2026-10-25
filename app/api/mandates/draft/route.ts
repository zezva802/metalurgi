import { z } from "zod";
import { draftMandate } from "@/lib/agent/draft";

// A5: draft a mandate from a plain-language request. Falls back to the template (never errors).
const Body = z.object({ request: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errors: ["Body must be { request }"] }, { status: 400 });
  }
  return Response.json(await draftMandate(parsed.data.request));
}
