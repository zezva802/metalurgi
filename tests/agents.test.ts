import { describe, expect, it, vi } from "vitest";
import { checkAgent, getAgent } from "@/lib/agents";
import { generateKeys, signCanonical } from "@/lib/supervisor/mandate";
import type { Proposal } from "@/lib/supervisor/proposal";
import { PROPOSAL_A } from "./fixtures";

const agent = generateKeys();
vi.mock("@/lib/keys", () => ({ loadPublicKey: () => agent.publicKey }));

const sign = (proposal: Proposal) => signCanonical(proposal, agent.privateKey);

describe("agent registry", () => {
  it("knows the active travel agent", () => {
    expect(getAgent("agent_travel_01")?.status).toBe("active");
  });

  it("returns undefined for an unknown agent", () => {
    expect(getAgent("agent_ghost")).toBeUndefined();
  });
});

describe("checkAgent", () => {
  it("passes a registered, active agent with a valid signature", () => {
    expect(checkAgent(PROPOSAL_A, sign(PROPOSAL_A))).toEqual({ pass: true, failures: [] });
  });

  it("blocks an unregistered agent", () => {
    const p = { ...PROPOSAL_A, agent_id: "agent_ghost" };
    const check = checkAgent(p, sign(p));
    expect(check.pass).toBe(false);
    expect(check.failures).toEqual([{ rule: "registered", message: "Agent agent_ghost is not in the bank's registry" }]);
  });

  it("blocks a suspended agent", () => {
    const p = { ...PROPOSAL_A, agent_id: "agent_legacy_01" };
    const check = checkAgent(p, sign(p));
    expect(check.pass).toBe(false);
    expect(check.failures.some((f) => f.rule === "status")).toBe(true);
  });

  it("blocks a proposal signed with the wrong key", () => {
    const wrong = generateKeys();
    const check = checkAgent(PROPOSAL_A, signCanonical(PROPOSAL_A, wrong.privateKey));
    expect(check.pass).toBe(false);
    expect(check.failures.some((f) => f.rule === "signature")).toBe(true);
  });

  it("blocks a tampered proposal (amount changed after signing)", () => {
    const signature = sign(PROPOSAL_A);
    const check = checkAgent({ ...PROPOSAL_A, amount: 999 }, signature);
    expect(check.pass).toBe(false);
    expect(check.failures.some((f) => f.rule === "signature")).toBe(true);
  });
});
