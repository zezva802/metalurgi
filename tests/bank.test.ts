import { beforeEach, describe, expect, it } from "vitest";
import { authorizePayment, executePayment, getTransactions, listPayments, resetBank } from "@/lib/bank";

const auth = {
  proposal_id: "p_001",
  mandate_id: "m_001",
  merchant: "bookify.example",
  amount: 540,
  currency: "EUR",
  authorized_by: "gateway",
};

beforeEach(() => resetBank());

describe("mock bank", () => {
  it("AIS returns Nino's history", () => {
    expect(getTransactions().length).toBe(151);
  });

  it("PIS refuses a payment the gateway never authorized", () => {
    expect(executePayment("p_001")).toEqual({ ok: false, error: "No gateway authorization for p_001" });
    expect(listPayments()).toEqual([]);
  });

  it("PIS executes an authorized payment", () => {
    authorizePayment(auth);
    const result = executePayment("p_001", new Date("2026-09-01T10:00:00Z"));
    expect(result).toEqual({
      ok: true,
      payment: { ...auth, payment_id: "pay_0001", status: "executed", executed_at: "2026-09-01T10:00:00.000Z" },
    });
  });

  it("an authorization can be used only once", () => {
    authorizePayment(auth);
    expect(executePayment("p_001").ok).toBe(true);
    expect(executePayment("p_001").ok).toBe(false);
    expect(listPayments()).toHaveLength(1);
  });
});
