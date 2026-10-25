import { connection } from "next/server";
import { toAuditEntry } from "@/lib/audit";
import { listDecisions } from "@/lib/decisions";

// S7: the persisted audit log, newest first. Survives restarts (data/audit.json).
export async function GET() {
  await connection();
  return Response.json({ entries: listDecisions().map(toAuditEntry) });
}
