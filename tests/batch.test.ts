import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetBank } from "@/lib/bank";
import { runBatch } from "@/lib/batch";
import { resetDecisions } from "@/lib/decisions";
import { resetStore } from "@/lib/store";
import { generateKeys } from "@/lib/supervisor/mandate";

const nino = generateKeys();
const agent = generateKeys();
vi.mock("@/lib/keys", () => ({
  loadPublicKey: (id: string) => (id === "nino" ? nino.publicKey : agent.publicKey),
  loadPrivateKey: (id: string) => (id === "nino" ? nino.privateKey : agent.privateKey),
}));

beforeEach(() => {
  resetStore();
  resetBank();
  resetDecisions();
});

describe("batch run (A8)", () => {
  it("produces the expected outcome distribution over 200 proposals", () => {
    const { total, bad, counts } = runBatch();
    expect(total).toBe(200);
    expect(bad).toBe(20);
    expect(counts).toEqual({ EXECUTE: 150, VERIFY: 15, ASK_HUMAN: 15, BLOCK: 20 });
  });

  it("blocks exactly the 20 bad proposals", () => {
    expect(runBatch().counts.BLOCK).toBe(20);
  });
});
