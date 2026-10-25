import { describe, expect, it } from "vitest";
import { scoreContext } from "@/lib/supervisor/context";
import type { Proposal } from "@/lib/supervisor/proposal";
import { PROPOSAL_A } from "./fixtures";

// Scenario C: €610 on an unknown site 4 days old, ~45% below market, 1 option compared.
const PROPOSAL_C: Proposal = {
  ...PROPOSAL_A,
  merchant: "paris-hotels-deal.shop",
  amount: 610,
  options_compared: 1,
};

describe("scoreContext", () => {
  it("scenario A is low (at market, known merchant, well shopped)", () => {
    const score = scoreContext(PROPOSAL_A);
    expect(score.signals).toEqual([]);
    expect(score.total).toBe(0);
  });

  it("scenario C is high with three named signals", () => {
    const score = scoreContext(PROPOSAL_C);
    const names = score.signals.map((s) => s.name).sort();
    expect(names).toEqual(["Below market", "Few options compared", "New merchant"]);
    expect(score.total).toBeGreaterThanOrEqual(50);
  });

  it("flags a merchant with no registry record as unknown", () => {
    const score = scoreContext({ ...PROPOSAL_A, merchant: "never-seen.example" });
    expect(score.signals.some((s) => s.name === "Unknown merchant")).toBe(true);
  });

  it("flags high payment velocity", () => {
    const score = scoreContext(PROPOSAL_A, { recentAgentPayments: 5 });
    expect(score.signals.some((s) => s.name === "High velocity")).toBe(true);
  });
});
