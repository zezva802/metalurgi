import { marketMedian, OFFERS, type Offer } from "../catalog";
import { evaluatePayment, type GatewayResult } from "../gateway";
import { loadPrivateKey } from "../keys";
import { getMandate } from "../store";
import { signCanonical } from "../supervisor/mandate";
import type { Proposal } from "../supervisor/proposal";

// The three tools the LLM agent (A4) can call. They are plain, deterministic functions over the
// synthetic catalog and the gateway — the model only chooses which to call and with what arguments.
// propose_payment is the only one that can move money, and it goes through the same gateway as
// everything else, so the mandate/behavior/context checks still apply.

export type SearchArgs = { city: string; from?: string; to?: string };

export function searchHotels(args: SearchArgs): Offer[] {
  return OFFERS.filter(
    (o) =>
      o.city.toLowerCase() === args.city.toLowerCase() &&
      (!args.from || o.dates.from === args.from) &&
      (!args.to || o.dates.to === args.to),
  );
}

export type ComparedOffer = Offer & { market_median: number | null; pct_below_market: number };

export function compareOffers(args: { offer_ids?: string[]; city?: string }): ComparedOffer[] {
  const base = args.offer_ids?.length
    ? OFFERS.filter((o) => args.offer_ids!.includes(o.offer_id))
    : args.city
      ? searchHotels({ city: args.city })
      : OFFERS;
  return base
    .map((o) => {
      const median = marketMedian(o) ?? null;
      return { ...o, market_median: median, pct_below_market: median ? Math.round((1 - o.amount / median) * 100) : 0 };
    })
    .sort((a, b) => a.amount - b.amount);
}

export type ProposeArgs = { mandate_id: string; offer_id: string; options_compared: number };
export type ProposeResult = { ok: true; result: GatewayResult } | { ok: false; error: string };

export function proposePayment(args: ProposeArgs): ProposeResult {
  const offer = OFFERS.find((o) => o.offer_id === args.offer_id);
  if (!offer) return { ok: false, error: `Unknown offer ${args.offer_id}` };
  const stored = getMandate(args.mandate_id);
  if (!stored) return { ok: false, error: `Unknown mandate ${args.mandate_id}` };

  const agentId = stored.mandate.agent_id;
  const proposal: Proposal = {
    proposal_id: `p_llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mandate_id: args.mandate_id,
    agent_id: agentId,
    merchant: offer.merchant,
    category: "hotel",
    city: offer.city,
    dates: offer.dates,
    amount: offer.amount,
    currency: offer.currency,
    refundable: offer.refundable,
    options_compared: args.options_compared,
    created_at: new Date().toISOString(),
  };

  const signature = signCanonical(proposal, loadPrivateKey(agentId));
  return { ok: true, result: evaluatePayment(proposal, signature) };
}
