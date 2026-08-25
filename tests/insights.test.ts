import { describe, it, expect } from "vitest";
import {
  rankInsights,
  coverageGapInsight,
  credentialInsight,
  overtimeInsight,
  unpublishedInsight,
} from "@/lib/insights";

describe("coverageGapInsight", () => {
  it("is null when fully covered", () => {
    expect(coverageGapInsight({ facilityName: "F", understaffed: 0, toFill: 0, dayLabel: "today" })).toBeNull();
  });
  it("is critical when understaffed", () => {
    const i = coverageGapInsight({ facilityName: "F", understaffed: 2, toFill: 1, dayLabel: "today" })!;
    expect(i.severity).toBe("critical");
    expect(i.detail).toContain("2 understaffed");
  });
  it("is a warning when only unfilled", () => {
    const i = coverageGapInsight({ facilityName: "F", understaffed: 0, toFill: 3, dayLabel: "tomorrow" })!;
    expect(i.severity).toBe("warning");
  });
});

describe("credentialInsight", () => {
  it("is null with nothing expiring", () => {
    expect(credentialInsight({ expired: 0, expiring: 0 })).toBeNull();
  });
  it("is critical when something is expired", () => {
    expect(credentialInsight({ expired: 1, expiring: 2 })!.severity).toBe("critical");
  });
  it("is a warning when only expiring", () => {
    expect(credentialInsight({ expired: 0, expiring: 2 })!.severity).toBe("warning");
  });
});

describe("overtimeInsight", () => {
  it("is null with no risk", () => {
    expect(overtimeInsight({ count: 0 })).toBeNull();
  });
  it("pluralizes correctly", () => {
    expect(overtimeInsight({ count: 1 })!.detail).toContain("person is");
    expect(overtimeInsight({ count: 3 })!.detail).toContain("people are");
  });
});

describe("rankInsights", () => {
  it("orders critical, then warning, then info", () => {
    const list = [
      unpublishedInsight({ facilityName: "F" }), // info
      credentialInsight({ expired: 1, expiring: 0 })!, // critical
      overtimeInsight({ count: 2 })!, // warning
    ];
    expect(rankInsights(list).map((i) => i.severity)).toEqual(["critical", "warning", "info"]);
  });
});
