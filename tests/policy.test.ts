import { afterEach, describe, expect, it } from "vitest";
import { decide } from "@/lib/supervisor/decide";
import { getPolicy, resetPolicy, setPolicy } from "@/lib/supervisor/policy";

afterEach(() => resetPolicy());

const PASS = { pass: true, failures: [] };
const ZERO = { total: 0, signals: [] };

describe("live policy (S9)", () => {
  it("defaults to the committed thresholds", () => {
    expect(getPolicy()).toEqual({ contextBlock: 90, contextVerify: 50, behaviorAsk: 40 });
  });

  it("lowering behaviorAsk makes a normal (zero-score) decision ask for approval", () => {
    // Scenario A's profile: hard rules pass, behavior and context both 0 → EXECUTE by default.
    expect(decide({ mandate: PASS, behavior: ZERO, context: ZERO }).outcome).toBe("EXECUTE");
    setPolicy({ behaviorAsk: 0 });
    expect(decide({ mandate: PASS, behavior: ZERO, context: ZERO }).outcome).toBe("ASK_HUMAN");
  });

  it("reset restores the defaults", () => {
    setPolicy({ behaviorAsk: 0, contextVerify: 5 });
    resetPolicy();
    expect(getPolicy()).toEqual({ contextBlock: 90, contextVerify: 50, behaviorAsk: 40 });
  });
});
