import type { KeyObject } from "node:crypto";
import { nextMandateId, saveMandate, type StoredMandate } from "./store";
import { MandateSchema, signCanonical } from "./supervisor/mandate";

// The bank app's customer. In the demo, the bank app holds Nino's key and signs on her device's behalf.
export const PRINCIPAL_ID = "nino";

export type CreateMandateResult =
  | { ok: true; entry: StoredMandate }
  | { ok: false; errors: string[] };

// Validates the draft, assigns a fresh mandate_id and the principal, signs and stores it.
// The server sets mandate_id and principal_id so a draft cannot overwrite another mandate or sign for someone else.
export function createMandate(draft: unknown, privateKey: KeyObject, now = new Date()): CreateMandateResult {
  const base = typeof draft === "object" && draft !== null ? draft : {};
  const parsed = MandateSchema.safeParse({ ...base, mandate_id: "pending", principal_id: PRINCIPAL_ID });
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "mandate"}: ${i.message}`),
    };
  }
  if (parsed.data.dates.from > parsed.data.dates.to) {
    return { ok: false, errors: ["dates: 'from' must not be after 'to'"] };
  }

  // Sign the parsed object (defaults filled in), so the stored mandate is exactly what was signed.
  const mandate = { ...parsed.data, mandate_id: nextMandateId() };
  const entry: StoredMandate = {
    mandate,
    signature: signCanonical(mandate, privateKey),
    signed_at: now.toISOString(),
  };
  saveMandate(entry);
  return { ok: true, entry };
}

// Starting point shown in the bank app editor (matches docs/CLAUDE.md, with a later expiry for the demo).
export const MANDATE_TEMPLATE = {
  agent_id: "agent_travel_01",
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  max_amount: 800,
  currency: "EUR",
  max_uses: 1,
  preferences: { refundable: true },
  expires_at: "2026-12-31T23:59:00Z",
};
