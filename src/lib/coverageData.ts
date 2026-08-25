import { prisma } from "./db";
import {
  buildCoverageLines,
  summarizeCoverage,
  type CoverageLine,
  type CoverageTotals,
} from "./coverage";
import { weekDays } from "./week";

// Server-side aggregation that turns the daily coverage template + a week's
// scheduled shifts into per-day coverage for one facility.

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DayCoverage {
  dayOffset: number;
  dateKey: string;
  lines: CoverageLine[];
  totals: CoverageTotals;
}

export interface FacilityWeekCoverage {
  facilityId: string;
  facilityName: string;
  built: boolean; // a schedule exists for the week
  published: boolean;
  days: DayCoverage[];
  week: CoverageTotals; // rollup across the whole week
}

/**
 * Required counts come from the DAILY template (same every day). Scheduled and
 * confirmed come from the week's actual shifts, bucketed by UTC day.
 */
export async function facilityWeekCoverage(
  facilityId: string,
  facilityName: string,
  weekStart: Date
): Promise<FacilityWeekCoverage> {
  const [template, schedule] = await Promise.all([
    prisma.templateShift.findMany({
      where: { facilityId, active: true },
      select: { position: true, count: true },
    }),
    prisma.schedule.findUnique({
      where: { facilityId_weekStart: { facilityId, weekStart } },
      include: {
        shifts: {
          where: { status: { not: "CANCELLED" } },
          select: { position: true, assignedToId: true, agencyId: true, startTime: true },
        },
      },
    }),
  ]);

  const requiredByPosition: Record<string, number> = {};
  for (const t of template) {
    requiredByPosition[t.position] = (requiredByPosition[t.position] ?? 0) + t.count;
  }

  const shifts = schedule?.shifts ?? [];
  const byDay = new Map<string, { position: string; assigned: boolean }[]>();
  for (const s of shifts) {
    const key = utcDayKey(s.startTime);
    const arr = byDay.get(key) ?? [];
    arr.push({ position: s.position, assigned: !!s.assignedToId || !!s.agencyId });
    byDay.set(key, arr);
  }

  const days: DayCoverage[] = weekDays(weekStart).map((day, i) => {
    const dateKey = utcDayKey(day);
    const lines = buildCoverageLines(requiredByPosition, byDay.get(dateKey) ?? []);
    return { dayOffset: i, dateKey, lines, totals: summarizeCoverage(lines) };
  });

  // Week rollup: sum every day's line into one set of per-position lines.
  const weekLines = buildCoverageLines(
    // Required is per-day × 7 for the weekly view.
    Object.fromEntries(Object.entries(requiredByPosition).map(([p, c]) => [p, c * days.length])),
    shifts.map((s) => ({ position: s.position, assigned: !!s.assignedToId || !!s.agencyId }))
  );

  return {
    facilityId,
    facilityName,
    built: !!schedule && shifts.length > 0,
    published: schedule?.published ?? false,
    days,
    week: summarizeCoverage(weekLines),
  };
}
