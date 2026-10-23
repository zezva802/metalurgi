import { describe, expect, it } from "vitest";
import { findMerchant, marketMedian, OFFERS } from "@/lib/catalog";

const offer = (id: string) => OFFERS.find((o) => o.offer_id === id)!;

describe("hotel catalog", () => {
  it("has ~20 Paris offers for 20–23 September", () => {
    expect(OFFERS.length).toBe(20);
    for (const o of OFFERS) {
      expect(o).toMatchObject({ city: "Paris", dates: { from: "2026-09-20", to: "2026-09-23" }, nights: 3, currency: "EUR" });
    }
    expect(new Set(OFFERS.map((o) => o.offer_id)).size).toBe(OFFERS.length);
  });

  it("A: €540 refundable on a known platform, at market price", () => {
    const a = offer("o_001");
    expect(a).toMatchObject({ merchant: "bookify.example", amount: 540, refundable: true });
    expect(findMerchant(a.merchant)?.known).toBe(true);
    expect(a.amount).toBeGreaterThanOrEqual(marketMedian(a)! * 0.9);
  });

  it("B: €760 non-refundable on a known platform", () => {
    const b = offer("o_004");
    expect(b).toMatchObject({ amount: 760, refundable: false });
    expect(findMerchant(b.merchant)?.known).toBe(true);
  });

  it("C: €610 on paris-hotels-deal.shop, unknown, 4 days old, ~45% below market", () => {
    const c = offer("o_007");
    expect(c).toMatchObject({ merchant: "paris-hotels-deal.shop", amount: 610, refundable: true });
    expect(findMerchant(c.merchant)).toEqual({ domain: "paris-hotels-deal.shop", known: false, age_days: 4 });
    const below = 1 - c.amount / marketMedian(c)!;
    expect(below).toBeCloseTo(0.45, 2);
  });

  it("D: €950, over Nino's €800 limit", () => {
    expect(offer("o_011").amount).toBe(950);
  });

  it("every offer's merchant is in the registry", () => {
    for (const o of OFFERS) expect(findMerchant(o.merchant), o.merchant).toBeDefined();
  });

  it("marketMedian is undefined when no other platform sells the hotel", () => {
    expect(marketMedian(OFFERS.find((o) => o.hotel_id === "h_canal")!)).toBeUndefined();
  });
});
