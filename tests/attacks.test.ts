import { describe, expect, it, vi } from "vitest";
import { runAttacks } from "@/lib/attacks";
import { generateKeys } from "@/lib/supervisor/mandate";

// Nino signs mandates, the agent signs proposals; mock both key lookups by id.
const nino = generateKeys();
const agent = generateKeys();
vi.mock("@/lib/keys", () => ({
  loadPublicKey: (id: string) => (id === "nino" ? nino.publicKey : agent.publicKey),
  loadPrivateKey: (id: string) => (id === "nino" ? nino.privateKey : agent.privateKey),
}));

describe("attack suite", () => {
  const results = runAttacks();

  it("covers all eight attacks", () => {
    expect(results).toHaveLength(8);
  });

  it("executes none of them", () => {
    const executed = results.filter((r) => r.executed);
    expect(executed, executed.map((r) => r.name).join(", ")).toEqual([]);
  });

  for (const name of [
    "forged mandate signature",
    "altered mandate amount",
    "payment after revocation",
    "reuse of single-use mandate",
    "split payments over budget",
    "expired mandate",
    "unknown agent",
    "wrong agent key",
  ]) {
    it(`blocks: ${name}`, () => {
      const r = results.find((x) => x.name === name)!;
      expect(r.outcome).toBe("BLOCK");
    });
  }
});
