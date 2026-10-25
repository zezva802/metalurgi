import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetBank } from "@/lib/bank";
import { resetDecisions } from "@/lib/decisions";
import { resetStore, saveMandate } from "@/lib/store";
import { compareOffers, proposePayment, searchHotels } from "@/lib/agent/tools";
import { draftMandate } from "@/lib/agent/draft";
import { hasLlm, runLlmAgent } from "@/lib/agent/llm";
import { generateKeys, signCanonical } from "@/lib/supervisor/mandate";
import { MANDATE } from "./fixtures";

// The agent signs proposals and the gateway verifies; mock both key lookups to one in-test keypair.
const key = generateKeys();
vi.mock("@/lib/keys", () => ({
  loadPublicKey: () => key.publicKey,
  loadPrivateKey: () => key.privateKey,
}));

// proposePayment uses the real clock (no injected `now`), so give the mandate a far-future expiry —
// the shared MANDATE fixture expires 2026-10-25, which would make this time-dependent.
const MANDATE_FUTURE = { ...MANDATE, expires_at: "2027-12-31T23:59:00Z" };

beforeEach(() => {
  resetStore();
  resetBank();
  resetDecisions();
  saveMandate({ mandate: MANDATE_FUTURE, signature: signCanonical(MANDATE_FUTURE, key.privateKey), signed_at: "2026-09-01T09:00:00Z" });
});

describe("agent tools", () => {
  it("search_hotels returns Paris offers for the mandate dates", () => {
    const offers = searchHotels({ city: "Paris", from: "2026-09-20", to: "2026-09-23" });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.city === "Paris")).toBe(true);
  });

  it("compare_offers flags the deep discount on the unknown site", () => {
    const compared = compareOffers({ offer_ids: ["o_007"] });
    expect(compared[0].pct_below_market).toBeGreaterThan(30);
  });

  it("propose_payment books scenario A through the gateway → EXECUTE", () => {
    // o_001: €540 refundable on bookify (a known platform).
    const res = proposePayment({ mandate_id: "m_001", offer_id: "o_001", options_compared: 6 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.decision.outcome).toBe("EXECUTE");
  });

  it("propose_payment errors clearly on an unknown offer", () => {
    const res = proposePayment({ mandate_id: "m_001", offer_id: "nope", options_compared: 1 });
    expect(res).toEqual({ ok: false, error: "Unknown offer nope" });
  });
});

describe("LLM fallbacks when no key is configured", () => {
  it("hasLlm is false without ANTHROPIC_API_KEY", () => {
    expect(hasLlm()).toBe(Boolean(process.env.ANTHROPIC_API_KEY));
  });

  it("runLlmAgent throws a helpful error without a key", async () => {
    if (hasLlm()) return; // only meaningful without a key
    await expect(runLlmAgent("Book a hotel", "m_001")).rejects.toThrow(/scripted agent/i);
  });

  it("draftMandate falls back to a valid template without a key", async () => {
    if (hasLlm()) return;
    const { draft, source } = await draftMandate("Book me a refundable Paris hotel up to €800");
    expect(source).toBe("template");
    expect(draft).toMatchObject({ category: "hotel", city: "Paris", currency: "EUR" });
  });
});
