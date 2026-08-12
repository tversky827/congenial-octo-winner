// Pay calculation. Kept framework-free and pure so it's easy to reason about and test.

export interface PayInput {
  startTime: Date | string;
  endTime: Date | string;
  hourlyRate: number;
  differential?: number;
  breakMinutes?: number;
  overtimeAfterHours?: number;
  overtimeMultiplier?: number;
}

export interface PayBreakdown {
  /** Total paid hours after subtracting the unpaid break. */
  paidHours: number;
  regularHours: number;
  overtimeHours: number;
  /** hourlyRate + differential */
  effectiveRate: number;
  regularPay: number;
  overtimePay: number;
  total: number;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Compute what a worker earns for a shift.
 *
 * - Paid hours = clock time minus the unpaid break.
 * - The differential is added to the base rate for every paid hour.
 * - Hours worked beyond `overtimeAfterHours` (in a single shift) are paid at
 *   `overtimeMultiplier` (default time-and-a-half).
 */
export function computePay(input: PayInput): PayBreakdown {
  const start = toDate(input.startTime).getTime();
  const end = toDate(input.endTime).getTime();

  const breakMinutes = Math.max(0, input.breakMinutes ?? 0);
  const rawHours = (end - start) / (1000 * 60 * 60);
  const paidHours = Math.max(0, rawHours - breakMinutes / 60);

  const overtimeAfter = input.overtimeAfterHours ?? 8;
  const overtimeMultiplier = input.overtimeMultiplier ?? 1.5;
  const effectiveRate = round2(input.hourlyRate + (input.differential ?? 0));

  const regularHours = Math.min(paidHours, overtimeAfter);
  const overtimeHours = Math.max(0, paidHours - overtimeAfter);

  const regularPay = round2(regularHours * effectiveRate);
  const overtimePay = round2(overtimeHours * effectiveRate * overtimeMultiplier);
  const total = round2(regularPay + overtimePay);

  return {
    paidHours: round2(paidHours),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    effectiveRate,
    regularPay,
    overtimePay,
    total,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
