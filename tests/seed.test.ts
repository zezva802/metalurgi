import { describe, expect, it } from "vitest";
import { generateTransactions, HOTEL_PLATFORMS } from "@/data/seed";
import { TransactionSchema } from "@/lib/transactions";
import saved from "@/data/transactions.json";

const transactions = generateTransactions();
const hotels = transactions.filter((t) => t.category === "hotel");

describe("seed: Nino's history", () => {
  it("is deterministic and matches the committed file", () => {
    expect(generateTransactions()).toEqual(transactions);
    expect(saved).toEqual(transactions);
  });

  it("has ~150 valid transactions over 12 months", () => {
    expect(transactions.length).toBeGreaterThanOrEqual(140);
    expect(transactions.length).toBeLessThanOrEqual(160);
    for (const t of transactions) TransactionSchema.parse(t);
    expect(transactions[0].date >= "2025-09-01").toBe(true);
    expect(transactions.at(-1)!.date <= "2026-08-31").toBe(true);
  });

  it("has 8–10 refundable hotel stays at €90–160/night on 2–3 known platforms", () => {
    expect(hotels.length).toBeGreaterThanOrEqual(8);
    expect(hotels.length).toBeLessThanOrEqual(10);
    for (const h of hotels) {
      expect(h.refundable).toBe(true);
      const perNight = h.amount / h.nights!;
      expect(perNight).toBeGreaterThanOrEqual(90);
      expect(perNight).toBeLessThanOrEqual(160);
    }
    const platforms = new Set(hotels.map((h) => h.merchant));
    expect(platforms.size).toBeGreaterThanOrEqual(2);
    expect([...platforms].every((p) => HOTEL_PLATFORMS.includes(p))).toBe(true);
    expect(platforms.has("bookify.example")).toBe(true); // scenario A's platform is known to her
  });
});
