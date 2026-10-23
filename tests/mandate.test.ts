import { describe, expect, it } from "vitest";
import { canonicalize, MandateSchema, type Mandate } from "@/lib/supervisor/mandate";

const mandate: Mandate = {
  mandate_id: "m_001",
  principal_id: "nino",
  agent_id: "agent_travel_01",
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  max_amount: 800,
  currency: "EUR",
  max_uses: 1,
  preferences: { refundable: true },
  expires_at: "2026-10-25T18:00:00Z",
};

describe("canonicalize", () => {
  it("ignores key order, including nested objects", () => {
    const shuffled = {
      expires_at: mandate.expires_at,
      preferences: { refundable: true },
      max_uses: 1,
      currency: "EUR",
      max_amount: 800,
      dates: { to: "2026-09-23", from: "2026-09-20" },
      city: "Paris",
      category: "hotel",
      agent_id: "agent_travel_01",
      principal_id: "nino",
      mandate_id: "m_001",
    };
    expect(canonicalize(shuffled)).toBe(canonicalize(mandate));
  });

  it("sorts keys and has no whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("keeps array order", () => {
    expect(canonicalize({ x: [3, 1, 2] })).toBe('{"x":[3,1,2]}');
  });

  it("changes when a value changes", () => {
    expect(canonicalize({ ...mandate, max_amount: 2000 })).not.toBe(canonicalize(mandate));
  });
});

describe("MandateSchema", () => {
  it("accepts the template mandate", () => {
    expect(MandateSchema.safeParse(mandate).success).toBe(true);
  });

  it("rejects a bad date and a negative amount", () => {
    expect(MandateSchema.safeParse({ ...mandate, dates: { from: "20 Sep", to: "2026-09-23" } }).success).toBe(false);
    expect(MandateSchema.safeParse({ ...mandate, max_amount: -5 }).success).toBe(false);
  });
});
