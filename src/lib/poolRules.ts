// Pure predicates for pool-shift claiming rules. Dependency-free and unit-tested;
// the claim service enforces them server-side (never the frontend). Configurable
// thresholds come from poolSettings.

export interface TimeRange {
  start: Date;
  end: Date;
}

/** Two ranges overlap when each starts before the other ends. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** Does the candidate overlap any existing commitment? */
export function hasOverlap(candidate: TimeRange, commitments: TimeRange[]): boolean {
  return commitments.some((c) => overlaps(candidate, c));
}

/**
 * Minimum-rest violation: the candidate starts/ends too close to a neighbouring
 * commitment (gap smaller than minRestHours on either side). Overlap is handled
 * separately, so touching the exact boundary with zero rest also violates.
 */
export function violatesRest(candidate: TimeRange, commitments: TimeRange[], minRestHours: number): boolean {
  if (minRestHours <= 0) return false;
  const restMs = minRestHours * 3_600_000;
  for (const c of commitments) {
    if (overlaps(candidate, c)) continue; // overlap, not a rest issue
    // gap between the candidate and this commitment, whichever comes first
    const gap =
      candidate.start.getTime() >= c.end.getTime()
        ? candidate.start.getTime() - c.end.getTime()
        : c.start.getTime() - candidate.end.getTime();
    if (gap < restMs) return true;
  }
  return false;
}

/** Would claiming `addHours` push the nurse past the weekly cap? */
export function exceedsMaxWeeklyHours(existingWeekHours: number, addHours: number, maxHoursPerWeek: number): boolean {
  if (maxHoursPerWeek <= 0) return false;
  return existingWeekHours + addHours > maxHoursPerWeek + 1e-9;
}

/** Is there still an open seat on the shift? */
export function seatAvailable(seatsFilled: number, nursesNeeded: number): boolean {
  return seatsFilled < nursesNeeded;
}

/** Paid scheduled hours for a shift window, minus unpaid break. */
export function scheduledHours(start: Date, end: Date, breakMinutes = 0): number {
  const ms = end.getTime() - start.getTime();
  const hours = ms / 3_600_000 - breakMinutes / 60;
  return Math.max(0, Math.round(hours * 100) / 100);
}
