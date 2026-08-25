// Time-clock math. Pure functions so they can be unit-tested and reused by the
// clock-out route and any payroll/labor reporting.

/** Whole minutes worked between two punches (never negative). */
export function workedMinutes(clockInAt: Date, clockOutAt: Date): number {
  const ms = clockOutAt.getTime() - clockInAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 60000);
}

/** Pay for an actual worked span: hours × rate + a flat shift bonus. No OT here. */
export function actualPay(minutes: number, hourlyRate: number, bonus = 0): number {
  const hours = minutes / 60;
  return Math.round((hours * hourlyRate + bonus) * 100) / 100;
}

/** How a punch reads relative to its scheduled shift — for attendance display. */
export type PunchTiming = "early" | "on-time" | "late";

export function punchTiming(
  scheduledStart: Date,
  clockInAt: Date,
  graceMinutes = 5
): PunchTiming {
  const diffMin = (clockInAt.getTime() - scheduledStart.getTime()) / 60000;
  if (diffMin > graceMinutes) return "late";
  if (diffMin < -graceMinutes) return "early";
  return "on-time";
}
