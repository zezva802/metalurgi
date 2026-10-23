import transactionsJson from "@/data/transactions.json";
import { TransactionSchema, type Transaction } from "./transactions";

// Mock bank (Open Banking AIS + PIS). A separate system from the gateway, with its own state.
// Guardrail: PIS executes only a payment the gateway has authorized (after EXECUTE or a logged
// human approval), and each authorization can be used once.

export const ACCOUNT_ID = "acc_nino_001"; // synthetic

export type Authorization = {
  proposal_id: string;
  mandate_id: string;
  merchant: string;
  amount: number;
  currency: string;
  authorized_by: string; // "gateway" for EXECUTE, "approver:<name>" for a human approval
};

export type Payment = Authorization & { payment_id: string; status: "executed"; executed_at: string };

type BankState = { authorizations: Map<string, Authorization>; payments: Payment[] };

const g = globalThis as typeof globalThis & { __metalurgiBank?: BankState };
const emptyBank = (): BankState => ({ authorizations: new Map(), payments: [] });
const bank: BankState = (g.__metalurgiBank ??= emptyBank());

export function resetBank(): void {
  Object.assign(bank, emptyBank());
}

// AIS: Nino's account history.
const TRANSACTIONS: Transaction[] = TransactionSchema.array().parse(transactionsJson);

export function getTransactions(): Transaction[] {
  return TRANSACTIONS;
}

// Called by the gateway only, never by agents.
export function authorizePayment(auth: Authorization): void {
  bank.authorizations.set(auth.proposal_id, auth);
}

export type ExecuteResult = { ok: true; payment: Payment } | { ok: false; error: string };

// PIS: executes an authorized payment exactly once.
export function executePayment(proposal_id: string, now = new Date()): ExecuteResult {
  const auth = bank.authorizations.get(proposal_id);
  if (!auth) {
    return { ok: false, error: `No gateway authorization for ${proposal_id}` };
  }
  bank.authorizations.delete(proposal_id); // one use
  const payment: Payment = {
    ...auth,
    payment_id: `pay_${String(bank.payments.length + 1).padStart(4, "0")}`,
    status: "executed",
    executed_at: now.toISOString(),
  };
  bank.payments.push(payment);
  return { ok: true, payment };
}

export function listPayments(): Payment[] {
  return [...bank.payments].reverse(); // newest first
}
