// Reporting math. Pure + testable; the data layer feeds it rows pulled per
// facility/period.

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export interface FillStats {
  scheduled: number; // shifts that exist in the plan
  confirmed: number; // assigned/filled
  open: number;      // still in the marketplace
}

/** Percentage of scheduled shifts that have a named worker. */
export function fillRate(s: FillStats): number {
  return pct(s.confirmed, s.scheduled);
}

export interface LaborLine {
  // Actual pay once the shift is worked (from a closed time entry), else null.
  actualPay: number | null;
  // What the shift is expected to cost (rate × scheduled hours + bonus).
  projectedPay: number;
  // Minutes actually worked, if clocked out.
  workedMinutes: number | null;
}

export interface LaborSummary {
  totalCost: number;     // actual where known, else projected
  actualCost: number;    // only worked shifts
  projectedCost: number; // only not-yet-worked shifts
  hoursWorked: number;
  shiftsWorked: number;
  shiftsPlanned: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeLabor(lines: LaborLine[]): LaborSummary {
  let actualCost = 0;
  let projectedCost = 0;
  let totalCost = 0;
  let workedMinutes = 0;
  let shiftsWorked = 0;

  for (const l of lines) {
    if (l.actualPay != null) {
      actualCost += l.actualPay;
      totalCost += l.actualPay;
      shiftsWorked++;
      workedMinutes += l.workedMinutes ?? 0;
    } else {
      projectedCost += l.projectedPay;
      totalCost += l.projectedPay;
    }
  }

  return {
    totalCost: round2(totalCost),
    actualCost: round2(actualCost),
    projectedCost: round2(projectedCost),
    hoursWorked: round2(workedMinutes / 60),
    shiftsWorked,
    shiftsPlanned: lines.length,
  };
}
