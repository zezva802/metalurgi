import { evaluatePayment } from "./gateway";
import { loadPrivateKey } from "./keys";
import { nextMandateId, revokeMandate, saveMandate } from "./store";
import type { OutcomeCounts } from "./decisions";
import { generateKeys, signCanonical, type Mandate, type PrivateKeyInput } from "./supervisor/mandate";
import type { Proposal } from "./supervisor/proposal";

// A8 (stretch): fire a realistic batch through the gateway — mostly legitimate payments across the
// EXECUTE/VERIFY/ASK_HUMAN outcomes, plus a block of 20 bad ones — and report counts per outcome.
// Deterministic: the same mix every run. It provisions its own mandates and does not reset state.

const AGENT = "agent_travel_01";

export type BatchSummary = { total: number; bad: number; counts: OutcomeCounts };

export function runBatch(now = new Date()): BatchSummary {
  const base: Omit<Mandate, "mandate_id"> = {
    principal_id: "nino",
    agent_id: AGENT,
    category: "hotel",
    city: "Paris",
    dates: { from: "2026-09-20", to: "2026-09-23" },
    max_amount: 10_000_000,
    currency: "EUR",
    max_uses: 100_000,
    preferences: { refundable: true },
    expires_at: "2026-12-31T23:59:00Z",
  };

  const put = (m: Mandate, opts: { expires_at?: string; revoke?: boolean } = {}): Mandate => {
    const mandate = { ...m, ...(opts.expires_at ? { expires_at: opts.expires_at } : {}) };
    saveMandate({ mandate, signature: signCanonical(mandate, loadPrivateKey("nino")), signed_at: now.toISOString() });
    if (opts.revoke) revokeMandate(mandate.mandate_id);
    return mandate;
  };

  const good = put({ ...base, mandate_id: nextMandateId() });
  const expired = put({ ...base, mandate_id: nextMandateId() }, { expires_at: "2020-01-01T00:00:00Z" });
  const revoked = put({ ...base, mandate_id: nextMandateId() }, { revoke: true });

  let n = 0;
  const proposal = (m: Mandate, overrides: Partial<Proposal> = {}): Proposal => ({
    proposal_id: `batch_${n++}`,
    mandate_id: m.mandate_id,
    agent_id: m.agent_id,
    merchant: "bookify.example",
    category: "hotel",
    city: "Paris",
    dates: m.dates,
    amount: 540,
    currency: "EUR",
    refundable: true,
    options_compared: 6,
    created_at: now.toISOString(),
    ...overrides,
  });

  const counts: OutcomeCounts = { EXECUTE: 0, VERIFY: 0, ASK_HUMAN: 0, BLOCK: 0 };
  const run = (p: Proposal, signWith: PrivateKeyInput = loadPrivateKey(AGENT)) => {
    counts[evaluatePayment(p, signCanonical(p, signWith), now).decision.outcome]++;
  };

  // 150 clean payments → EXECUTE.
  for (let i = 0; i < 150; i++) run(proposal(good));
  // 15 deep discounts on an unknown 4-day-old site, 1 option → VERIFY (high context).
  for (let i = 0; i < 15; i++) run(proposal(good, { merchant: "paris-hotels-deal.shop", amount: 610, options_compared: 1 }));
  // 15 non-refundable (unlike Nino) → ASK_HUMAN (high behavior).
  for (let i = 0; i < 15; i++) run(proposal(good, { merchant: "staywell.example", amount: 760, refundable: false }));

  // 20 bad → BLOCK, five of each kind.
  for (let i = 0; i < 5; i++) run(proposal(good, { agent_id: "agent_ghost" })); // unknown agent
  for (let i = 0; i < 5; i++) run(proposal(good), generateKeys().privateKey); // wrong agent key
  for (let i = 0; i < 5; i++) run(proposal(expired)); // expired mandate
  for (let i = 0; i < 5; i++) run(proposal(revoked)); // revoked mandate

  const total = counts.EXECUTE + counts.VERIFY + counts.ASK_HUMAN + counts.BLOCK;
  return { total, bad: 20, counts };
}
