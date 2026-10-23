import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("toolchain", () => {
  it("runs vitest and zod", () => {
    expect(z.number().max(800).safeParse(950).success).toBe(false);
  });
});
