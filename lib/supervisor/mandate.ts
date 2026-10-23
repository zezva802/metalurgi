import { generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { z } from "zod";
import type { Proposal } from "./proposal";

// A mandate is the narrow permission a customer signs for an agent.
// Everything except `preferences` is a hard rule checked before any payment.
// `preferences` are soft and only feed behavior scoring.

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const MandateSchema = z.object({
  mandate_id: z.string().min(1),
  principal_id: z.string().min(1),
  agent_id: z.string().min(1),
  category: z.string().min(1),
  city: z.string().min(1),
  dates: z.object({ from: isoDate, to: isoDate }),
  max_amount: z.number().positive(),
  currency: z.string().length(3),
  max_uses: z.number().int().positive(),
  preferences: z.object({ refundable: z.boolean().optional() }).default({}),
  expires_at: z.iso.datetime(),
});

export type Mandate = z.infer<typeof MandateSchema>;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// Rebuilds the value with object keys sorted at every level. Arrays keep their order.
function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const sorted: { [key: string]: Json } = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

// The exact string that gets signed and hashed: keys sorted recursively, then JSON.stringify.
// Two mandates with the same content always produce the same string, whatever their key order.
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value as Json));
}

// ---- Ed25519 signatures over canonical JSON ----
// Used for mandates (signed by the customer) and payment proposals (signed by the agent).

export type PublicKeyInput = KeyObject | string; // KeyObject or SPKI PEM
export type PrivateKeyInput = KeyObject | string; // KeyObject or PKCS#8 PEM

export function generateKeys(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync("ed25519");
}

// Returns a base64 signature of canonicalize(value).
export function signCanonical(value: unknown, privateKey: PrivateKeyInput): string {
  const data = Buffer.from(canonicalize(value), "utf8");
  return sign(null, data, privateKey).toString("base64");
}

// True only if `signature` was made over exactly this content with the matching private key.
// Malformed keys or signatures return false instead of throwing.
export function verifyCanonical(value: unknown, signature: string, publicKey: PublicKeyInput): boolean {
  try {
    const data = Buffer.from(canonicalize(value), "utf8");
    return verify(null, data, publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

// ---- Hard mandate checks ----
// Any failure here means BLOCK. Nothing downstream (behavior, context) can override it.

export type MandateRule =
  | "signature"
  | "expiry"
  | "mandate_id"
  | "agent_id"
  | "category"
  | "city"
  | "dates"
  | "currency"
  | "max_amount"
  | "max_uses"
  | "budget";

export type MandateFailure = { rule: MandateRule; message: string };
export type MandateCheck = { pass: boolean; failures: MandateFailure[] };

export type MandateState = {
  principalPublicKey: PublicKeyInput; // the customer's key the mandate must be signed with
  uses: number; // executed payments under this mandate so far
  spent: number; // total executed so far, in mandate currency
  now: Date;
};

const SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", GEL: "₾" };

export function formatMoney(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency];
  const value = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return symbol ? `${symbol}${value}` : `${value} ${currency}`;
}

export function checkMandate(
  mandate: Mandate,
  signature: string,
  proposal: Proposal,
  state: MandateState,
): MandateCheck {
  const failures: MandateFailure[] = [];
  const fail = (rule: MandateRule, message: string) => failures.push({ rule, message });
  const money = (amount: number) => formatMoney(amount, mandate.currency);

  if (!verifyCanonical(mandate, signature, state.principalPublicKey)) {
    fail("signature", "Mandate signature is invalid: it was changed after signing or not signed by the customer");
  }

  if (state.now.getTime() >= new Date(mandate.expires_at).getTime()) {
    fail("expiry", `Mandate expired at ${mandate.expires_at}`);
  }

  if (proposal.mandate_id !== mandate.mandate_id) {
    fail("mandate_id", `Proposal refers to mandate ${proposal.mandate_id}, not ${mandate.mandate_id}`);
  }

  if (proposal.agent_id !== mandate.agent_id) {
    fail("agent_id", `Mandate is for agent ${mandate.agent_id}, not ${proposal.agent_id}`);
  }

  if (proposal.category !== mandate.category) {
    fail("category", `Mandate covers ${mandate.category}, not ${proposal.category}`);
  }

  if (proposal.city !== mandate.city) {
    fail("city", `Mandate covers ${mandate.city}, not ${proposal.city}`);
  }

  // YYYY-MM-DD strings compare correctly as text.
  const { from, to } = proposal.dates;
  if (from > to || from < mandate.dates.from || to > mandate.dates.to) {
    fail("dates", `Dates ${from} to ${to} are outside the mandate (${mandate.dates.from} to ${mandate.dates.to})`);
  }

  if (proposal.currency !== mandate.currency) {
    fail("currency", `Mandate is in ${mandate.currency}, proposal is in ${proposal.currency}`);
  }

  if (proposal.amount > mandate.max_amount) {
    fail("max_amount", `Exceeds the ${money(mandate.max_amount)} limit (${money(proposal.amount)} requested)`);
  }

  if (state.uses >= mandate.max_uses) {
    fail("max_uses", `Mandate already used ${state.uses} of ${mandate.max_uses} times`);
  }

  // Only when the amount alone is within the limit, otherwise it just repeats the max_amount failure.
  if (proposal.amount <= mandate.max_amount && state.spent + proposal.amount > mandate.max_amount) {
    fail(
      "budget",
      `Would bring the total to ${money(state.spent + proposal.amount)}, over the ${money(mandate.max_amount)} budget (${money(state.spent)} already spent)`,
    );
  }

  return { pass: failures.length === 0, failures };
}
