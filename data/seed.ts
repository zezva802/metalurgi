// Generates Nino's synthetic 12-month payment history. Same seed → same file, every time.
// Run: npm run seed  (writes data/transactions.json)

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Transaction } from "../lib/transactions";

export const SEED = 20260920;
const START = Date.UTC(2025, 8, 1); // 2025-09-01, history ends before the Paris trip
const DAYS = 365;

export const HOTEL_PLATFORMS = ["bookify.example", "staywell.example", "roomly.example"];

const LOCAL: Record<"groceries" | "transport" | "cafe", { count: number; merchants: string[]; min: number; max: number; hours: [number, number] }> = {
  groceries: { count: 60, merchants: ["fresh-market.example", "corner-grocer.example", "daily-basket.example"], min: 15, max: 120, hours: [9, 21] },
  transport: { count: 45, merchants: ["city-metro.example", "ride-now.example", "fuel-stop.example"], min: 1, max: 40, hours: [7, 22] },
  cafe: { count: 37, merchants: ["bean-house.example", "old-town-cafe.example", "bakery-lane.example"], min: 5, max: 35, hours: [8, 20] },
};
const HOTEL_STAYS = 9;

// mulberry32: tiny deterministic PRNG.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTransactions(seed = SEED): Transaction[] {
  const random = rng(seed);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const money = (n: number) => Math.round(n * 100) / 100;
  const day = (offset: number) => new Date(START + offset * 86_400_000).toISOString().slice(0, 10);

  const rows: Omit<Transaction, "id">[] = [];

  for (const [category, spec] of Object.entries(LOCAL)) {
    for (let i = 0; i < spec.count; i++) {
      rows.push({
        date: day(int(0, DAYS - 1)),
        hour: int(...spec.hours),
        amount: money(spec.min + random() * (spec.max - spec.min)),
        currency: "GEL",
        merchant: pick(spec.merchants),
        category: category as Transaction["category"],
        refundable: null,
        nights: null,
      });
    }
  }

  // One hotel stay roughly every 40 days, always refundable, €90–200 per night.
  for (let i = 0; i < HOTEL_STAYS; i++) {
    const nights = int(1, 4);
    const perNight = int(90, 200);
    rows.push({
      date: day(i * 40 + int(0, 30)),
      hour: int(9, 21),
      amount: perNight * nights,
      currency: "EUR",
      merchant: HOTEL_PLATFORMS[i % HOTEL_PLATFORMS.length],
      category: "hotel",
      refundable: true,
      nights,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
  return rows.map((row, i) => ({ id: `t_${String(i + 1).padStart(3, "0")}`, ...row }));
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const transactions = generateTransactions();
  const file = join(process.cwd(), "data", "transactions.json");
  writeFileSync(file, JSON.stringify(transactions, null, 2) + "\n");
  const hotels = transactions.filter((t) => t.category === "hotel").length;
  console.log(`wrote ${transactions.length} transactions (${hotels} hotel stays) to data/transactions.json`);
}
