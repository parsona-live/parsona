import { describe, it, expect } from "vitest";
import { getActualCost, formatAiCost } from "./cost";

describe("getActualCost", () => {
  it("returns exact cost reported by API call", () => {
    expect(getActualCost(0.000125)).toBe(0.000125);
    expect(getActualCost(0)).toBe(0);
  });

  it("returns null when no cost was reported by the provider", () => {
    expect(getActualCost(undefined)).toBeNull();
    expect(getActualCost(null)).toBeNull();
    expect(getActualCost("invalid")).toBeNull();
    expect(getActualCost(-1)).toBeNull();
  });
});

describe("formatAiCost", () => {
  it("returns '—' when cost is null or undefined (historical / missing data)", () => {
    expect(formatAiCost(null)).toBe("—");
    expect(formatAiCost(undefined)).toBe("—");
  });

  it("formats $0.00 when cost is zero", () => {
    expect(formatAiCost(0)).toBe("$0.00");
  });

  it("formats actual amounts with INR equivalent", () => {
    const str = formatAiCost(0.0025, true);
    expect(str).toContain("$0.0025");
    expect(str).toContain("₹");
  });

  it("formats without INR when disabled", () => {
    const str = formatAiCost(0.0025, false);
    expect(str).toBe("$0.0025");
  });
});
