import { describe, expect, it, vi } from "vitest";
import { ATTACK_TYPES, runAttacks } from "@/lib/attacks";
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

  it("covers exactly the published attack types, in order", () => {
    expect(results.map((r) => r.name)).toEqual([...ATTACK_TYPES]);
  });

  it("executes none of them", () => {
    const executed = results.filter((r) => r.executed);
    expect(executed, executed.map((r) => r.name).join(", ")).toEqual([]);
  });

  for (const name of ATTACK_TYPES) {
    it(`blocks: ${name}`, () => {
      const r = results.find((x) => x.name === name)!;
      expect(r.outcome).toBe("BLOCK");
    });
  }
});
