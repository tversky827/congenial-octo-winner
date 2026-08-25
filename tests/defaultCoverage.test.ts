import { describe, it, expect } from "vitest";
import { DEFAULT_FACILITY_BUDGET, budgetToRows, SHIFT_WINDOWS } from "@/lib/defaultCoverage";

describe("default facility budget", () => {
  it("covers all 11 facilities", () => {
    expect(DEFAULT_FACILITY_BUDGET).toHaveLength(11);
  });

  it("omits buckets with no shift (e.g. Marseilles has no 6-10 or PM CNA)", () => {
    const marseilles = DEFAULT_FACILITY_BUDGET.find((b) => b.facility === "Marseilles")!;
    const rows = budgetToRows(marseilles);
    // CNA: AM 5, NOC 4; Nurse: AM 2, NOC 2 → 4 rows, no PM/MID.
    expect(rows).toHaveLength(4);
    expect(rows.some((r) => r.startTime === SHIFT_WINDOWS.MID.startTime)).toBe(false);
  });

  it("expands Clinton to its budgeted CNA counts", () => {
    const clinton = DEFAULT_FACILITY_BUDGET.find((b) => b.facility === "Clinton")!;
    const rows = budgetToRows(clinton).filter((r) => r.position === "CNA");
    const am = rows.find((r) => r.startTime === SHIFT_WINDOWS.AM.startTime)!;
    const mid = rows.find((r) => r.startTime === SHIFT_WINDOWS.MID.startTime)!;
    const noc = rows.find((r) => r.startTime === SHIFT_WINDOWS.NOC.startTime)!;
    expect(am.count).toBe(10);
    expect(mid.count).toBe(4);
    expect(noc.count).toBe(6);
  });

  it("captures Gibson's PM shifts (the only facility with PM in the grid besides SV/Toluca/Princeton)", () => {
    const gibson = DEFAULT_FACILITY_BUDGET.find((b) => b.facility === "Gibson")!;
    const pm = budgetToRows(gibson).filter((r) => r.startTime === SHIFT_WINDOWS.PM.startTime);
    // CNA PM 6, Nurse PM 2
    expect(pm.map((r) => `${r.position}:${r.count}`).sort()).toEqual(["CNA:6", "Nurse:2"]);
  });

  it("every row has a positive count and a valid window", () => {
    for (const b of DEFAULT_FACILITY_BUDGET) {
      for (const r of budgetToRows(b)) {
        expect(r.count).toBeGreaterThan(0);
        expect(r.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(r.endTime).toMatch(/^\d{2}:\d{2}$/);
        expect(["CNA", "Nurse"]).toContain(r.position);
      }
    }
  });
});
