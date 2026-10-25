import { findMerchant, marketMedian, OFFERS, type Offer } from "../catalog";
import type { Proposal } from "./proposal";
import { totalPoints, type Score, type Signal } from "./signals";

// Context: external risk around the proposal — the merchant, the price vs the wider market, how much
// the agent actually shopped, and how fast it is paying. Higher points mean more suspicious.
// Like behavior, context can only tighten the decision (E10); it never moves money on its own.

export type ContextInput = {
  offers?: Offer[]; // catalog used for the market-price comparison
  recentAgentPayments?: number; // this agent's executed payments in the last hour (velocity)
};

const BELOW_MARKET = 0.3; // more than 30% under the market median is suspicious

export function scoreContext(proposal: Proposal, input: ContextInput = {}): Score {
  const offers = input.offers ?? OFFERS;
  const signals: Signal[] = [];

  // Merchant standing. A brand-new domain (<30 days) is the strong signal; a merchant the bank has
  // no record of at all is the weaker one. They don't stack — a known-but-young domain is "new".
  const merchant = findMerchant(proposal.merchant);
  if (!merchant) {
    signals.push({ name: "Unknown merchant", points: 15, explanation: `${proposal.merchant} is not in the bank's merchant registry` });
  } else if (merchant.age_days < 30) {
    signals.push({ name: "New merchant", points: 35, explanation: `${proposal.merchant} is only ${merchant.age_days} days old` });
  }

  // Price far below the market median for the same hotel elsewhere (too good to be true).
  const booked = offers.find((o) => o.merchant === proposal.merchant && o.amount === proposal.amount);
  const median = booked ? marketMedian(booked, offers) : undefined;
  if (median !== undefined) {
    const below = 1 - proposal.amount / median;
    if (below > BELOW_MARKET) {
      signals.push({
        name: "Below market",
        points: 30,
        explanation: `${Math.round(below * 100)}% below the €${Math.round(median)} market median for this hotel`,
      });
    }
  }

  // The agent barely shopped around.
  if (proposal.options_compared < 2) {
    signals.push({
      name: "Few options compared",
      points: 20,
      explanation: `Only ${proposal.options_compared} option${proposal.options_compared === 1 ? "" : "s"} compared before paying`,
    });
  }

  // The agent is paying unusually fast.
  const velocity = input.recentAgentPayments ?? 0;
  if (velocity > 3) {
    signals.push({ name: "High velocity", points: 15, explanation: `${velocity} payments from this agent in the last hour` });
  }

  return { total: totalPoints(signals), signals };
}
