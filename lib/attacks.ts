import { resetBank } from "./bank";
import { resetDecisions } from "./decisions";
import { evaluatePayment, type GatewayResult } from "./gateway";
import { loadPrivateKey } from "./keys";
import { nextMandateId, resetStore, revokeMandate, saveMandate } from "./store";
import type { Outcome } from "./supervisor/decide";
import { generateKeys, signCanonical, type Mandate, type PrivateKeyInput } from "./supervisor/mandate";
import type { Proposal } from "./supervisor/proposal";

// E11: every known attack, run through the real gateway. None of them may EXECUTE. Shared by the
// vitest suite and `npm run attacks`, so the demo and the test prove the same thing.

const AGENT = "agent_travel_01";
const BASE: Omit<Mandate, "mandate_id"> = {
  principal_id: "nino",
  agent_id: AGENT,
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  max_amount: 800,
  currency: "EUR",
  max_uses: 1,
  preferences: { refundable: true },
  expires_at: "2026-12-31T23:59:00Z",
};

export type AttackResult = { name: string; outcome: Outcome; reasons: string[]; executed: boolean };

function makeRunner(now: Date) {
  const mandate = (overrides: Partial<Mandate> = {}): Mandate => ({ ...BASE, mandate_id: nextMandateId(), ...overrides });

  const store = (m: Mandate, opts: { signWith?: PrivateKeyInput; signedContent?: Mandate } = {}) => {
    const content = opts.signedContent ?? m;
    const key = opts.signWith ?? loadPrivateKey("nino");
    saveMandate({ mandate: m, signature: signCanonical(content, key), signed_at: now.toISOString() });
  };

  const proposal = (m: Mandate, overrides: Partial<Proposal> = {}): Proposal => ({
    proposal_id: `atk_${nextMandateId()}`,
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

  const send = (p: Proposal, signWith: PrivateKeyInput = loadPrivateKey(AGENT)): GatewayResult =>
    evaluatePayment(p, signCanonical(p, signWith), now);

  return { mandate, store, proposal, send };
}

export function runAttacks(now = new Date()): AttackResult[] {
  resetStore();
  resetBank();
  resetDecisions();
  const { mandate, store, proposal, send } = makeRunner(now);
  const results: AttackResult[] = [];
  const attempt = (name: string, res: GatewayResult) =>
    results.push({ name, outcome: res.decision.outcome, reasons: res.decision.reasons, executed: res.decision.outcome === "EXECUTE" });

  // 1. Forged mandate signature — the mandate was "signed" with an attacker key, not Nino's.
  {
    const m = mandate();
    store(m, { signWith: generateKeys().privateKey });
    attempt("forged mandate signature", send(proposal(m)));
  }

  // 2. Altered mandate — stored terms raised to €5,000 after Nino signed the €800 original.
  {
    const original = mandate();
    store({ ...original, max_amount: 5000 }, { signedContent: original });
    attempt("altered mandate amount", send(proposal({ ...original, max_amount: 5000 }, { amount: 3000 })));
  }

  // 3. Payment after the customer revoked the mandate.
  {
    const m = mandate();
    store(m);
    revokeMandate(m.mandate_id);
    attempt("payment after revocation", send(proposal(m)));
  }

  // 4. Reuse of a single-use mandate (first legitimate payment, then a second).
  {
    const m = mandate();
    store(m);
    send(proposal(m, { amount: 475 })); // legitimate first use
    attempt("reuse of single-use mandate", send(proposal(m, { amount: 475 })));
  }

  // 5. Split payments to slip over the budget (multi-use mandate, €500 then €400 > €800).
  {
    const m = mandate({ max_uses: 5 });
    store(m);
    send(proposal(m, { amount: 500 })); // legitimate first use
    attempt("split payments over budget", send(proposal(m, { amount: 400 })));
  }

  // 6. Expired mandate.
  {
    const m = mandate({ expires_at: "2020-01-01T00:00:00Z" });
    store(m);
    attempt("expired mandate", send(proposal(m)));
  }

  // 7. Unknown agent not in the bank's registry.
  {
    const m = mandate({ agent_id: "agent_ghost" });
    store(m);
    attempt("unknown agent", send(proposal(m, { agent_id: "agent_ghost" })));
  }

  // 8. Wrong agent key — a registered agent's proposal signed with the wrong key.
  {
    const m = mandate();
    store(m);
    attempt("wrong agent key", send(proposal(m), generateKeys().privateKey));
  }

  return results;
}
