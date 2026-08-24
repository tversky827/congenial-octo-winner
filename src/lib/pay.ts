// Pay calculation. Kept framework-free and pure so it's easy to reason about.
//
// Pay = the employee's hourly rate × hours worked, plus an optional flat
// pick-up bonus on the shift. No overtime, differentials, or unpaid breaks.

export interface PayInput {
  startTime: Date | string;
  endTime: Date | string;
  /** The employee's hourly rate. */
  hourlyRate: number;
  /** Flat pick-up bonus for the shift. */
  bonus?: number;
}

export interface PayBreakdown {
  hours: number;
  hourlyRate: number;
  /** hours × hourlyRate */
  basePay: number;
  bonus: number;
  total: number;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function computePay(input: PayInput): PayBreakdown {
  const start = toDate(input.startTime).getTime();
  const end = toDate(input.endTime).getTime();

  const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
  const hourlyRate = input.hourlyRate ?? 0;
  const bonus = input.bonus ?? 0;

  const basePay = round2(hours * hourlyRate);
  const total = round2(basePay + bonus);

  return {
    hours: round2(hours),
    hourlyRate,
    basePay,
    bonus,
    total,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
