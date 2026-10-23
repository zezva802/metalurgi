import { beforeEach, describe, expect, it } from "vitest";
import { createMandate, MANDATE_TEMPLATE } from "@/lib/mandates";
import { getMandate, resetStore } from "@/lib/store";
import { generateKeys, verifyCanonical } from "@/lib/supervisor/mandate";

const nino = generateKeys();

beforeEach(() => resetStore());

describe("createMandate", () => {
  it("signs the template, assigns m_001 and stores it", () => {
    const result = createMandate(MANDATE_TEMPLATE, nino.privateKey);
    if (!result.ok) throw new Error(result.errors.join(", "));
    const { mandate, signature } = result.entry;
    expect(mandate.mandate_id).toBe("m_001");
    expect(mandate.principal_id).toBe("nino");
    expect(verifyCanonical(mandate, signature, nino.publicKey)).toBe(true);
    expect(getMandate("m_001")).toEqual(result.entry);
  });

  it("assigns increasing ids", () => {
    createMandate(MANDATE_TEMPLATE, nino.privateKey);
    const second = createMandate(MANDATE_TEMPLATE, nino.privateKey);
    expect(second.ok && second.entry.mandate.mandate_id).toBe("m_002");
  });

  it("ignores client-supplied mandate_id and principal_id", () => {
    const result = createMandate({ ...MANDATE_TEMPLATE, mandate_id: "m_999", principal_id: "mallory" }, nino.privateKey);
    expect(result.ok && result.entry.mandate).toMatchObject({ mandate_id: "m_001", principal_id: "nino" });
  });

  it("rejects invalid drafts with readable errors", () => {
    const result = createMandate({ ...MANDATE_TEMPLATE, max_amount: "lots" }, nino.privateKey);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toMatch(/^max_amount:/);
  });

  it("rejects reversed dates", () => {
    const result = createMandate({ ...MANDATE_TEMPLATE, dates: { from: "2026-09-23", to: "2026-09-20" } }, nino.privateKey);
    expect(result.ok).toBe(false);
  });
});
