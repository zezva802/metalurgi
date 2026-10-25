import { describe, expect, it } from "vitest";
import { getTransactions } from "@/lib/bank";
import { scoreBehavior } from "@/lib/supervisor/behavior";
import { PROPOSAL_A } from "./fixtures";

const history = getTransactions();
const max = (nums: number[]) => Math.max(...nums);

describe("scoreBehavior", () => {
  it("scenario A is normal for Nino (low score, no signals)", () => {
    const score = scoreBehavior(PROPOSAL_A, history);
    expect(score.signals).toEqual([]);
    expect(score.total).toBe(0);
  });

  it("scenario B: points come mostly from non-refundable", () => {
    const score = scoreBehavior({ ...PROPOSAL_A, amount: 760, refundable: false }, history);
    const nonRefundable = score.signals.find((s) => s.name === "Non-refundable");
    expect(nonRefundable).toBeDefined();
    // It fires and is the single largest contributor.
    expect(nonRefundable!.points).toBe(max(score.signals.map((s) => s.points)));
    expect(score.total).toBeGreaterThanOrEqual(40); // enough to ASK_HUMAN under the starting policy
  });

  it("flags a merchant she has never used", () => {
    const score = scoreBehavior({ ...PROPOSAL_A, merchant: "paris-hotels-deal.shop" }, history);
    expect(score.signals.some((s) => s.name === "New merchant")).toBe(true);
  });

  it("flags a price per night far above her usual", () => {
    const score = scoreBehavior({ ...PROPOSAL_A, amount: 1500 }, history);
    const price = score.signals.find((s) => s.name === "Price per night");
    expect(price?.points).toBe(30); // capped
  });
});
