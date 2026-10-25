import type { Transaction } from "../transactions";
import type { Proposal } from "./proposal";
import { clamp, percentile, totalPoints, type Score, type Signal } from "./signals";

// Behavior: is this proposal normal *for Nino*, judged only against her own history? Higher points
// mean less like her. These can only tighten the decision (E10); they never move money on their own.

export function nightsOf(proposal: Pick<Proposal, "dates">): number {
  const nights = Math.round((Date.parse(proposal.dates.to) - Date.parse(proposal.dates.from)) / 86_400_000);
  return nights > 0 ? nights : 1;
}

export function scoreBehavior(proposal: Proposal, history: Transaction[]): Score {
  const hotels = history.filter((t) => t.category === "hotel");
  const signals: Signal[] = [];
  if (hotels.length === 0) return { total: 0, signals };

  // Price per night vs her 10–90th percentile band (≤30).
  const perNight = proposal.amount / nightsOf(proposal);
  const seen = hotels.map((h) => h.amount / (h.nights ?? 1)).sort((a, b) => a - b);
  const p10 = percentile(seen, 0.1);
  const p90 = percentile(seen, 0.9);
  const band = `€${Math.round(p10)}–€${Math.round(p90)}`;
  if (perNight > p90) {
    const points = clamp(Math.round(((perNight - p90) / p90) * 60), 1, 30);
    signals.push({ name: "Price per night", points, explanation: `€${Math.round(perNight)}/night is above her usual ${band}` });
  } else if (perNight < p10) {
    const points = clamp(Math.round(((p10 - perNight) / p10) * 60), 1, 30);
    signals.push({ name: "Price per night", points, explanation: `€${Math.round(perNight)}/night is below her usual ${band}` });
  }

  // A merchant she has never booked with (≤25).
  const known = new Set(hotels.map((h) => h.merchant));
  if (!known.has(proposal.merchant)) {
    signals.push({ name: "New merchant", points: 25, explanation: `She has not booked with ${proposal.merchant} before` });
  }

  // Non-refundable when she is almost always refundable (≤30).
  const refundableRate = hotels.filter((h) => h.refundable).length / hotels.length;
  if (!proposal.refundable && refundableRate >= 0.8) {
    signals.push({
      name: "Non-refundable",
      points: 30,
      explanation: `${Math.round(refundableRate * 100)}% of her stays are refundable; this one is not`,
    });
  }

  // Booked at an hour she never books (≤15).
  const hours = hotels.map((h) => h.hour);
  const earliest = Math.min(...hours);
  const latest = Math.max(...hours);
  const hour = new Date(proposal.created_at).getUTCHours();
  if (hour < earliest || hour > latest) {
    signals.push({
      name: "Unusual hour",
      points: 15,
      explanation: `Booked at ${String(hour).padStart(2, "0")}:00; she usually books ${earliest}:00–${latest}:00`,
    });
  }

  return { total: totalPoints(signals), signals };
}
