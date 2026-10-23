import { connection } from "next/server";
import { ACCOUNT_ID, getTransactions } from "@/lib/bank";

// Mock Open Banking AIS: Nino's account history (synthetic).
export async function GET() {
  await connection();
  return Response.json({ account_id: ACCOUNT_ID, transactions: getTransactions() });
}
