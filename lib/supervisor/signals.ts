// Shared shape for behavior (E8) and context (E9) scores. Each signal is one plain-language reason
// with a point weight, so the console can draw a labelled bar per signal (S5).

export type Signal = { name: string; points: number; explanation: string };
export type Score = { total: number; signals: Signal[] };

// A score is capped at 100 so a pile-up of signals can't run off the end of the bar.
export function totalPoints(signals: Signal[]): number {
  return Math.min(100, signals.reduce((sum, s) => sum + s.points, 0));
}

// Linear-interpolated percentile over an ascending array (matches the usual "nearest rank" lerp).
export function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const i = q * (sortedAsc.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (i - lo);
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
