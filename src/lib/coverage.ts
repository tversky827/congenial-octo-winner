// Staffing requirements engine.
//
// For any facility/day we compare four numbers per position:
//   Required  — how many shifts the coverage template says are needed
//   Scheduled — how many shifts actually exist in the plan
//   Confirmed — how many of those have a named employee assigned
//   Open      — scheduled shifts still unassigned (Scheduled − Confirmed)
//
// (Actual — who really clocked in — arrives with the time clock in Phase 2.)
//
// The status light is what schedulers scan for at a glance:
//   🔴 red   — the plan itself is short (Scheduled < Required): real gaps
//   🟡 amber — enough shifts exist but not all are filled (Confirmed < Required)
//   🟢 green — every required shift is confirmed
//
// These are pure functions so they can be unit-tested without a database.

export type CoverageStatus = "red" | "amber" | "green";

export interface CoverageLine {
  position: string;
  required: number;
  scheduled: number;
  confirmed: number;
  open: number;
  gap: number; // required shortfall against confirmed (never negative)
  status: CoverageStatus;
}

export interface CoverageTotals {
  required: number;
  scheduled: number;
  confirmed: number;
  open: number;
  gap: number;
  status: CoverageStatus;
}

/** A single planned shift, reduced to what coverage math needs. */
export interface CoverageShift {
  position: string;
  assigned: boolean; // has a named employee (ASSIGNED or FILLED)
}

export function coverageStatus(
  required: number,
  scheduled: number,
  confirmed: number
): CoverageStatus {
  if (required <= 0) return "green"; // nothing required → nothing to worry about
  if (scheduled < required) return "red";
  if (confirmed < required) return "amber";
  return "green";
}

/**
 * Build one coverage line per position, taking the union of positions that are
 * required and positions that have shifts (so extra shifts still show up, and
 * required-but-empty positions surface as red).
 */
export function buildCoverageLines(
  requiredByPosition: Record<string, number>,
  shifts: CoverageShift[]
): CoverageLine[] {
  const scheduledBy = new Map<string, number>();
  const confirmedBy = new Map<string, number>();
  for (const s of shifts) {
    scheduledBy.set(s.position, (scheduledBy.get(s.position) ?? 0) + 1);
    if (s.assigned) confirmedBy.set(s.position, (confirmedBy.get(s.position) ?? 0) + 1);
  }

  const positions = new Set<string>([
    ...Object.keys(requiredByPosition),
    ...scheduledBy.keys(),
  ]);

  const lines: CoverageLine[] = [];
  for (const position of positions) {
    const required = requiredByPosition[position] ?? 0;
    const scheduled = scheduledBy.get(position) ?? 0;
    const confirmed = confirmedBy.get(position) ?? 0;
    lines.push({
      position,
      required,
      scheduled,
      confirmed,
      open: Math.max(0, scheduled - confirmed),
      gap: Math.max(0, required - confirmed),
      status: coverageStatus(required, scheduled, confirmed),
    });
  }

  // Worst status first (red, then amber, then green), then by position name.
  const rank: Record<CoverageStatus, number> = { red: 0, amber: 1, green: 2 };
  lines.sort((a, b) => rank[a.status] - rank[b.status] || a.position.localeCompare(b.position));
  return lines;
}

/** Roll a set of coverage lines into one facility/day summary. */
export function summarizeCoverage(lines: CoverageLine[]): CoverageTotals {
  const totals = lines.reduce(
    (acc, l) => {
      acc.required += l.required;
      acc.scheduled += l.scheduled;
      acc.confirmed += l.confirmed;
      acc.open += l.open;
      acc.gap += l.gap;
      return acc;
    },
    { required: 0, scheduled: 0, confirmed: 0, open: 0, gap: 0 }
  );
  // The summary is as bad as its worst line.
  const worst: CoverageStatus = lines.some((l) => l.status === "red")
    ? "red"
    : lines.some((l) => l.status === "amber")
      ? "amber"
      : "green";
  return { ...totals, status: worst };
}

export const STATUS_META: Record<CoverageStatus, { dot: string; label: string; tone: string }> = {
  red: { dot: "🔴", label: "Understaffed", tone: "text-red-700 bg-red-50" },
  amber: { dot: "🟡", label: "Needs filling", tone: "text-amber-700 bg-amber-50" },
  green: { dot: "🟢", label: "Covered", tone: "text-emerald-700 bg-emerald-50" },
};
