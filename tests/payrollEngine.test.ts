import { describe, it, expect } from "vitest";
import {
  splitOvertime,
  calculateAssignmentPay,
  calculateWeek,
  sumPayroll,
  DEFAULT_OVERTIME_RULES,
} from "@/lib/payrollEngine";

describe("splitOvertime (weekly)", () => {
  it("keeps everything regular under the weekly threshold", () => {
    const s = splitOvertime([{ id: "a", hours: 8 }, { id: "b", hours: 8 }], DEFAULT_OVERTIME_RULES);
    expect(s).toEqual([
      { id: "a", regularHours: 8, overtimeHours: 0 },
      { id: "b", regularHours: 8, overtimeHours: 0 },
    ]);
  });

  it("rolls hours past 40 into overtime, chronologically", () => {
    // 8*5 = 40 regular, then the 6th 8h shift is all OT.
    const week = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `d${n}`, hours: 8 }));
    const s = splitOvertime(week, DEFAULT_OVERTIME_RULES);
    expect(s.slice(0, 5).every((x) => x.overtimeHours === 0)).toBe(true);
    expect(s[5]).toEqual({ id: "d6", regularHours: 0, overtimeHours: 8 });
  });

  it("splits the boundary assignment", () => {
    // 36 regular used, a 10h shift → 4 regular + 6 OT.
    const s = splitOvertime([{ id: "a", hours: 36 }, { id: "b", hours: 10 }], DEFAULT_OVERTIME_RULES);
    expect(s[1]).toEqual({ id: "b", regularHours: 4, overtimeHours: 6 });
  });
});

describe("splitOvertime (daily)", () => {
  it("treats per-shift hours beyond the daily threshold as OT", () => {
    const rules = { ...DEFAULT_OVERTIME_RULES, mode: "daily" as const };
    const s = splitOvertime([{ id: "a", hours: 12 }, { id: "b", hours: 8 }], rules);
    expect(s[0]).toEqual({ id: "a", regularHours: 8, overtimeHours: 4 });
    expect(s[1]).toEqual({ id: "b", regularHours: 8, overtimeHours: 0 });
  });
});

describe("calculateAssignmentPay", () => {
  it("prices the §13 example: 8 reg @40 + 2 OT @1.5", () => {
    const p = calculateAssignmentPay({ regularHours: 8, overtimeHours: 2, baseRate: 40, multiplier: 1.5 });
    expect(p.regularPay).toBe(320);
    expect(p.overtimePay).toBe(120); // 2 * 40 * 1.5
    expect(p.grossPay).toBe(440);
  });

  it("applies a differential to every worked hour", () => {
    const p = calculateAssignmentPay({ regularHours: 8, overtimeHours: 0, baseRate: 40, multiplier: 1.5, differentialPerHour: 2 });
    expect(p.differentialPay).toBe(16);
    expect(p.grossPay).toBe(336);
  });
});

describe("§46 acceptance math", () => {
  it("8h @ $38 = $304, all regular, no OT", () => {
    const [res] = calculateWeek([{ id: "jane", approvedHours: 8, baseRate: 38 }]);
    expect(res.regularHours).toBe(8);
    expect(res.overtimeHours).toBe(0);
    expect(res.grossPay).toBe(304);
  });
});

describe("calculateWeek + sumPayroll", () => {
  it("totals a multi-facility week with weekly OT", () => {
    // Jane: Facility1 8h@38, Facility7 8h@38, Facility3 12h@38 across the week
    // = 28h total → all regular (under 40).
    const week = calculateWeek([
      { id: "f1", approvedHours: 8, baseRate: 38 },
      { id: "f7", approvedHours: 8, baseRate: 38 },
      { id: "f3", approvedHours: 12, baseRate: 38 },
    ]);
    const totals = sumPayroll(week);
    expect(totals.regularHours).toBe(28);
    expect(totals.overtimeHours).toBe(0);
    expect(totals.grossPay).toBe(round(28 * 38));
  });

  it("carries OT into the gross when the week exceeds 40h", () => {
    const week = calculateWeek([
      { id: "a", approvedHours: 36, baseRate: 40 },
      { id: "b", approvedHours: 12, baseRate: 40 },
    ]);
    const totals = sumPayroll(week);
    expect(totals.regularHours).toBe(40);
    expect(totals.overtimeHours).toBe(8);
    // 40*40 + 8*40*1.5 = 1600 + 480 = 2080
    expect(totals.grossPay).toBe(2080);
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
