// PayrollCalculationService — pure, deterministic, unit-tested.
//
// Money math never runs in a React component and never hard-codes overtime law:
// the organization's rules come in as `OvertimeRules` (from SystemSetting). This
// module splits worked hours into regular vs overtime and computes pay for an
// assignment. Inputs are plain numbers so every rule is testable without a DB.

export interface OvertimeRules {
  // "weekly": OT is hours beyond `weeklyThresholdHours` across the pay week.
  // "daily":  OT is each shift's hours beyond `dailyThresholdHours`.
  mode: "weekly" | "daily";
  weeklyThresholdHours: number; // e.g. 40
  dailyThresholdHours: number; // e.g. 8 (used in "daily" mode)
  multiplier: number; // e.g. 1.5
}

export const DEFAULT_OVERTIME_RULES: OvertimeRules = {
  mode: "weekly",
  weeklyThresholdHours: 40,
  dailyThresholdHours: 8,
  multiplier: 1.5,
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface HoursInput {
  id: string;
  hours: number; // approved payable hours for the assignment
}

export interface HoursSplit {
  id: string;
  regularHours: number;
  overtimeHours: number;
}

/**
 * Split a nurse's assignments for ONE pay week into regular vs overtime hours.
 * Deterministic: pass assignments in chronological order. In "weekly" mode the
 * first `weeklyThresholdHours` worked in the week are regular and the remainder
 * is overtime; in "daily" mode each assignment's hours beyond the daily
 * threshold are overtime. No pyramiding — a given hour is counted once.
 */
export function splitOvertime(assignments: HoursInput[], rules: OvertimeRules): HoursSplit[] {
  if (rules.mode === "daily") {
    return assignments.map((a) => {
      const overtime = Math.max(0, round2(a.hours - rules.dailyThresholdHours));
      return { id: a.id, regularHours: round2(a.hours - overtime), overtimeHours: overtime };
    });
  }

  // weekly
  let regularRemaining = rules.weeklyThresholdHours;
  return assignments.map((a) => {
    const regular = Math.max(0, Math.min(a.hours, regularRemaining));
    const overtime = round2(a.hours - regular);
    regularRemaining = Math.max(0, round2(regularRemaining - regular));
    return { id: a.id, regularHours: round2(regular), overtimeHours: overtime };
  });
}

export interface AssignmentPayInput {
  regularHours: number;
  overtimeHours: number;
  baseRate: number;
  multiplier: number; // overtime multiplier
  differentialPerHour?: number; // added to every worked hour
}

export interface AssignmentPay {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  differentialPay: number;
  grossPay: number;
}

/** Compute pay for one assignment from its regular/overtime split. */
export function calculateAssignmentPay(input: AssignmentPayInput): AssignmentPay {
  const diff = input.differentialPerHour ?? 0;
  const regularPay = round2(input.regularHours * input.baseRate);
  const overtimePay = round2(input.overtimeHours * input.baseRate * input.multiplier);
  const differentialPay = round2((input.regularHours + input.overtimeHours) * diff);
  const grossPay = round2(regularPay + overtimePay + differentialPay);
  return {
    regularHours: input.regularHours,
    overtimeHours: input.overtimeHours,
    regularPay,
    overtimePay,
    differentialPay,
    grossPay,
  };
}

export interface WeekAssignment {
  id: string;
  approvedHours: number;
  baseRate: number;
  differentialPerHour?: number;
}

export interface CalculatedAssignment extends AssignmentPay {
  id: string;
}

/**
 * Full week calculation: split OT across the week, then price each assignment.
 * This is the authoritative entry point used when finalizing a pay period for
 * one nurse. Returns one priced result per assignment, in input order.
 */
export function calculateWeek(
  assignments: WeekAssignment[],
  rules: OvertimeRules = DEFAULT_OVERTIME_RULES
): CalculatedAssignment[] {
  const splits = splitOvertime(
    assignments.map((a) => ({ id: a.id, hours: a.approvedHours })),
    rules
  );
  const byId = new Map(splits.map((s) => [s.id, s]));
  return assignments.map((a) => {
    const split = byId.get(a.id)!;
    const pay = calculateAssignmentPay({
      regularHours: split.regularHours,
      overtimeHours: split.overtimeHours,
      baseRate: a.baseRate,
      multiplier: rules.multiplier,
      differentialPerHour: a.differentialPerHour,
    });
    return { id: a.id, ...pay };
  });
}

/** Roll a nurse's priced assignments into their payroll-record totals. */
export function sumPayroll(items: CalculatedAssignment[]) {
  return items.reduce(
    (acc, i) => ({
      regularHours: round2(acc.regularHours + i.regularHours),
      overtimeHours: round2(acc.overtimeHours + i.overtimeHours),
      regularPay: round2(acc.regularPay + i.regularPay),
      overtimePay: round2(acc.overtimePay + i.overtimePay),
      differentialPay: round2(acc.differentialPay + i.differentialPay),
      grossPay: round2(acc.grossPay + i.grossPay),
    }),
    { regularHours: 0, overtimeHours: 0, regularPay: 0, overtimePay: 0, differentialPay: 0, grossPay: 0 }
  );
}
