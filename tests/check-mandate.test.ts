import { describe, expect, it } from "vitest";
import { checkMandate, generateKeys, signCanonical, type MandateState } from "@/lib/supervisor/mandate";
import type { Proposal } from "@/lib/supervisor/proposal";
import { BEFORE_EXPIRY, MANDATE, PROPOSAL_A } from "./fixtures";

const nino = generateKeys();
const signature = signCanonical(MANDATE, nino.privateKey);
const fresh: MandateState = { principalPublicKey: nino.publicKey, uses: 0, spent: 0, now: BEFORE_EXPIRY };

function check(proposal: Partial<Proposal> = {}, state: Partial<MandateState> = {}, mandate = MANDATE) {
  return checkMandate(mandate, signature, { ...PROPOSAL_A, ...proposal }, { ...fresh, ...state });
}

const rules = (result: ReturnType<typeof check>) => result.failures.map((f) => f.rule);

describe("checkMandate", () => {
  it("scenario A proposal passes every rule", () => {
    expect(check()).toEqual({ pass: true, failures: [] });
  });

  it("signature: mandate edited after signing (scenario E)", () => {
    const result = check({}, {}, { ...MANDATE, max_amount: 2000 });
    expect(result.pass).toBe(false);
    expect(rules(result)).toEqual(["signature"]);
  });

  it("signature: signed by someone other than the customer", () => {
    const stranger = generateKeys();
    const result = checkMandate(MANDATE, signCanonical(MANDATE, stranger.privateKey), PROPOSAL_A, fresh);
    expect(rules(result)).toEqual(["signature"]);
  });

  it("expiry: payment at or after expires_at", () => {
    expect(rules(check({}, { now: new Date(MANDATE.expires_at) }))).toEqual(["expiry"]);
    expect(check({}, { now: new Date("2026-10-25T17:59:59Z") }).pass).toBe(true);
  });

  it("mandate_id: proposal points at another mandate", () => {
    expect(rules(check({ mandate_id: "m_999" }))).toEqual(["mandate_id"]);
  });

  it("agent_id: a different agent uses the mandate", () => {
    expect(rules(check({ agent_id: "agent_other_02" }))).toEqual(["agent_id"]);
  });

  it("category: not a hotel", () => {
    expect(rules(check({ category: "flight" }))).toEqual(["category"]);
  });

  it("city: not Paris", () => {
    expect(rules(check({ city: "Lyon" }))).toEqual(["city"]);
  });

  it("dates: starts early, ends late, or reversed", () => {
    expect(rules(check({ dates: { from: "2026-09-19", to: "2026-09-23" } }))).toEqual(["dates"]);
    expect(rules(check({ dates: { from: "2026-09-20", to: "2026-09-24" } }))).toEqual(["dates"]);
    expect(rules(check({ dates: { from: "2026-09-22", to: "2026-09-21" } }))).toEqual(["dates"]);
    expect(check({ dates: { from: "2026-09-21", to: "2026-09-22" } }).pass).toBe(true);
  });

  it("currency: proposal in another currency", () => {
    expect(rules(check({ currency: "USD" }))).toEqual(["currency"]);
  });

  it("max_amount: scenario D, €950 exceeds the €800 limit", () => {
    const result = check({ amount: 950 });
    expect(result.pass).toBe(false);
    expect(result.failures).toContainEqual({
      rule: "max_amount",
      message: "Exceeds the €800 limit (€950 requested)",
    });
  });

  it("max_amount: exactly €800 is allowed", () => {
    expect(check({ amount: 800 }).pass).toBe(true);
  });

  it("max_uses: single-use mandate already used", () => {
    expect(rules(check({ amount: 100 }, { uses: 1, spent: 540 }))).toEqual(["max_uses"]);
  });

  it("budget: spent + amount over max_amount", () => {
    const multiUse = { ...MANDATE, max_uses: 3 };
    const sig = signCanonical(multiUse, nino.privateKey);
    const result = checkMandate(multiUse, sig, { ...PROPOSAL_A, amount: 300 }, { ...fresh, uses: 1, spent: 540 });
    expect(rules(result)).toEqual(["budget"]);
  });

  it("scenario G: two €475 payments on a single-use mandate, second is blocked", () => {
    const first = check({ amount: 475 });
    expect(first.pass).toBe(true);
    // State after the first payment executes.
    const second = check({ proposal_id: "p_002", amount: 475 }, { uses: 1, spent: 475 });
    expect(second.pass).toBe(false);
    expect(rules(second)).toEqual(["max_uses", "budget"]);
  });

  it("reports every failure, not just the first", () => {
    const result = check({ city: "Lyon", amount: 950, currency: "USD" });
    expect(rules(result)).toEqual(["city", "currency", "max_amount"]);
  });
});
