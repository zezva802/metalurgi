import type { Mandate } from "./supervisor/mandate";

// In-memory store for the demo. Kept on globalThis so it survives Next.js hot reloads in dev.
// Audit entries move to a persisted file in S7.

export type StoredMandate = {
  mandate: Mandate;
  signature: string; // base64 Ed25519 over canonicalize(mandate)
  signed_at: string;
};

export type Usage = { uses: number; spent: number };

type Store = {
  mandates: Map<string, StoredMandate>;
  revoked: Set<string>;
  usage: Map<string, Usage>;
  nextMandateNumber: number;
};

const g = globalThis as typeof globalThis & { __metalurgiStore?: Store };

function emptyStore(): Store {
  return { mandates: new Map(), revoked: new Set(), usage: new Map(), nextMandateNumber: 1 };
}

export const store: Store = (g.__metalurgiStore ??= emptyStore());

export function resetStore(): void {
  Object.assign(store, emptyStore());
}

// m_001, m_002, ...
export function nextMandateId(): string {
  return `m_${String(store.nextMandateNumber++).padStart(3, "0")}`;
}

export function saveMandate(entry: StoredMandate): void {
  store.mandates.set(entry.mandate.mandate_id, entry);
  store.usage.set(entry.mandate.mandate_id, { uses: 0, spent: 0 });
}

export function getMandate(id: string): StoredMandate | undefined {
  return store.mandates.get(id);
}

export function listMandates(): StoredMandate[] {
  return [...store.mandates.values()].reverse(); // newest first
}

export function getUsage(id: string): Usage {
  return store.usage.get(id) ?? { uses: 0, spent: 0 };
}

// Called only after a payment actually executes, in the same gateway pass as the check, so the next
// proposal on this mandate sees the updated count and total (scenario G: single-use, budget).
export function recordExecution(id: string, amount: number): void {
  const current = getUsage(id);
  store.usage.set(id, { uses: current.uses + 1, spent: current.spent + amount });
}

// Revocation: the customer can cancel a mandate at any time. Revoked is permanent for the demo.
export function revokeMandate(id: string): boolean {
  if (!store.mandates.has(id)) return false;
  store.revoked.add(id);
  return true;
}

export function isRevoked(id: string): boolean {
  return store.revoked.has(id);
}
