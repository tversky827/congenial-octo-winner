// Overtime awareness. Pay itself never includes OT (by design), but schedulers
// need to *see* when assigning someone would push them past a weekly threshold.
// Pure + testable.

export const OT_THRESHOLD_HOURS = 40;
// How close to the threshold counts as "approaching".
export const OT_NEAR_HOURS = 4;

export type OvertimeFlag = "ok" | "near" | "over";

export interface WeeklyProjection {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  flag: OvertimeFlag;
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function overtimeFlag(totalHours: number, thresholdHours = OT_THRESHOLD_HOURS): OvertimeFlag {
  if (totalHours > thresholdHours) return "over";
  if (totalHours >= thresholdHours - OT_NEAR_HOURS) return "near";
  return "ok";
}

/**
 * Project a worker's week if `addedMinutes` were assigned on top of the minutes
 * they already have. Pass addedMinutes = 0 to describe their current week.
 */
export function projectWeekly(
  existingMinutes: number,
  addedMinutes = 0,
  thresholdHours = OT_THRESHOLD_HOURS
): WeeklyProjection {
  const totalHours = minutesToHours(existingMinutes + addedMinutes);
  const overtimeHours = Math.max(0, Math.round((totalHours - thresholdHours) * 100) / 100);
  const regularHours = Math.round((totalHours - overtimeHours) * 100) / 100;
  return { totalHours, regularHours, overtimeHours, flag: overtimeFlag(totalHours, thresholdHours) };
}

export const OT_FLAG_META: Record<OvertimeFlag, { tone: string; label: string }> = {
  ok: { tone: "text-slate-400", label: "" },
  near: { tone: "text-amber-600", label: "approaching OT" },
  over: { tone: "text-red-600", label: "overtime" },
};
