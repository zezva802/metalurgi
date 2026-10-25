import { evaluatePayment, type GatewayResult } from "../gateway";
import { loadPrivateKey } from "../keys";
import { nextMandateId, revokeMandate, saveMandate } from "../store";
import { signCanonical, type Mandate } from "../supervisor/mandate";
import type { Proposal } from "../supervisor/proposal";

// A6: the scripted agent replays the eight demo scenarios (docs/CLAUDE.md) through the real gateway.
// Each run provisions its own fresh mandate so repeated clicks never collide, signs the mandate as
// Nino and the proposal as the agent, and returns what the gateway decided — so the console updates
// exactly as it would for a live agent.

export type ScenarioId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type ScenarioRun = { scenario: ScenarioId; title: string; expected: string; outcomes: GatewayResult[] };

export const SCENARIOS: Record<ScenarioId, { title: string; expected: string }> = {
  A: { title: "€540 refundable, known platform, 6 options", expected: "EXECUTE" },
  B: { title: "€760 non-refundable, known platform", expected: "ASK_HUMAN" },
  C: { title: "€610, unknown site 4 days old, 45% below market, 1 option", expected: "VERIFY" },
  D: { title: "€950, over the €800 limit", expected: "BLOCK" },
  E: { title: "Mandate edited to €2,000 after signing", expected: "BLOCK" },
  F: { title: "Payment after the mandate is revoked", expected: "BLOCK" },
  G: { title: "Two €475 payments on a single-use mandate", expected: "EXECUTE then BLOCK" },
  H: { title: "Unknown agent", expected: "BLOCK" },
};

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

function mandateOf(overrides: Partial<Mandate> = {}): Mandate {
  return { ...BASE, mandate_id: nextMandateId(), ...overrides };
}

// Store a mandate with a signature over `signedContent` (defaults to the mandate itself). Passing a
// different `signedContent` is how scenario E forges a mismatch: stored terms differ from what was signed.
function store(mandate: Mandate, signedContent: Mandate = mandate): void {
  saveMandate({ mandate, signature: signCanonical(signedContent, loadPrivateKey("nino")), signed_at: new Date().toISOString() });
}

function proposalFor(mandate: Mandate, overrides: Partial<Proposal> = {}): Proposal {
  return {
    proposal_id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mandate_id: mandate.mandate_id,
    agent_id: mandate.agent_id,
    merchant: "bookify.example",
    category: "hotel",
    city: "Paris",
    dates: mandate.dates,
    amount: 540,
    currency: "EUR",
    refundable: true,
    options_compared: 6,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Sign as a real agent key (agent_travel_01). For the unknown-agent scenario the proposal names
// "agent_ghost", which the gateway rejects before it ever looks at the signature.
function send(proposal: Proposal): GatewayResult {
  return evaluatePayment(proposal, signCanonical(proposal, loadPrivateKey(AGENT)));
}

export function runScenario(id: ScenarioId): ScenarioRun {
  const meta = SCENARIOS[id];
  const outcomes: GatewayResult[] = [];

  switch (id) {
    case "A": {
      const m = mandateOf();
      store(m);
      outcomes.push(send(proposalFor(m)));
      break;
    }
    case "B": {
      const m = mandateOf();
      store(m);
      outcomes.push(send(proposalFor(m, { merchant: "staywell.example", amount: 760, refundable: false })));
      break;
    }
    case "C": {
      const m = mandateOf();
      store(m);
      outcomes.push(send(proposalFor(m, { merchant: "paris-hotels-deal.shop", amount: 610, options_compared: 1 })));
      break;
    }
    case "D": {
      const m = mandateOf();
      store(m);
      outcomes.push(send(proposalFor(m, { amount: 950 })));
      break;
    }
    case "E": {
      const original = mandateOf();
      const tampered = { ...original, max_amount: 2000 };
      store(tampered, original); // stored terms say €2,000, signature is over the €800 original
      outcomes.push(send(proposalFor(tampered, { amount: 1500 })));
      break;
    }
    case "F": {
      const m = mandateOf();
      store(m);
      revokeMandate(m.mandate_id);
      outcomes.push(send(proposalFor(m)));
      break;
    }
    case "G": {
      const m = mandateOf();
      store(m);
      outcomes.push(send(proposalFor(m, { amount: 475 })));
      outcomes.push(send(proposalFor(m, { amount: 475 })));
      break;
    }
    case "H": {
      const m = mandateOf({ agent_id: "agent_ghost" });
      store(m);
      outcomes.push(send(proposalFor(m, { agent_id: "agent_ghost" })));
      break;
    }
  }

  return { scenario: id, title: meta.title, expected: meta.expected, outcomes };
}
