import { describe, it, expect } from "vitest";
import { pct, fillRate, summarizeLabor } from "@/lib/analytics";

describe("pct", () => {
  it("rounds to whole percents", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 4)).toBe(50);
  });
  it("is 0 with a zero denominator", () => {
    expect(pct(5, 0)).toBe(0);
  });
});

describe("fillRate", () => {
  it("is confirmed over scheduled", () => {
    expect(fillRate({ scheduled: 10, confirmed: 7, open: 3 })).toBe(70);
  });
});

describe("summarizeLabor", () => {
  it("uses actual pay where known and projection otherwise", () => {
    const s = summarizeLabor([
      { actualPay: 200, projectedPay: 180, workedMinutes: 480 },
      { actualPay: null, projectedPay: 160, workedMinutes: null },
    ]);
    expect(s.actualCost).toBe(200);
    expect(s.projectedCost).toBe(160);
    expect(s.totalCost).toBe(360);
    expect(s.hoursWorked).toBe(8);
    expect(s.shiftsWorked).toBe(1);
    expect(s.shiftsPlanned).toBe(2);
  });

  it("handles an all-projected period", () => {
    const s = summarizeLabor([
      { actualPay: null, projectedPay: 100, workedMinutes: null },
      { actualPay: null, projectedPay: 50, workedMinutes: null },
    ]);
    expect(s.totalCost).toBe(150);
    expect(s.actualCost).toBe(0);
    expect(s.hoursWorked).toBe(0);
  });
});
