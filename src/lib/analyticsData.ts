import { prisma } from "./db";
import { fillRate, summarizeLabor, pct, type LaborLine } from "./analytics";
import { actualPay } from "./timeclock";

export interface FacilityReport {
  facilityId: string;
  facilityName: string;
  scheduled: number;
  confirmed: number;
  open: number;
  completed: number;
  agencyFilled: number;
  callOffs: number;
  fillRatePct: number;
  labor: ReturnType<typeof summarizeLabor>;
}

export interface OrgReport {
  from: Date;
  to: Date;
  facilities: FacilityReport[];
  totals: {
    scheduled: number;
    confirmed: number;
    open: number;
    completed: number;
    agencyFilled: number;
    callOffs: number;
    fillRatePct: number;
    laborCost: number;
    hoursWorked: number;
  };
}

function shiftMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Build a report for one facility over [from, to). */
async function facilityReport(
  facilityId: string,
  facilityName: string,
  from: Date,
  to: Date
): Promise<FacilityReport> {
  const [shifts, callOffs] = await Promise.all([
    prisma.shift.findMany({
      where: { facilityId, startTime: { gte: from, lt: to }, status: { not: "CANCELLED" } },
      select: {
        status: true,
        assignedToId: true,
        agencyId: true,
        startTime: true,
        endTime: true,
        bonus: true,
        assignedTo: { select: { baseRate: true } },
        agency: { select: { billRate: true } },
        timeEntries: { select: { actualPay: true, actualMinutes: true } },
      },
    }),
    prisma.callOff.count({ where: { shift: { facilityId }, createdAt: { gte: from, lt: to } } }),
  ]);

  let confirmed = 0;
  let open = 0;
  let completed = 0;
  let agencyFilled = 0;
  const laborLines: LaborLine[] = shifts.map((s) => {
    if (s.status === "OPEN") open++;
    if (s.assignedToId || s.agencyId) confirmed++;
    if (s.agencyId) agencyFilled++;
    if (s.status === "COMPLETED") completed++;

    // Agency shifts bill at the agency rate; employee shifts at their pay rate.
    const rate = s.agencyId ? s.agency?.billRate ?? 0 : s.assignedTo?.baseRate ?? 0;
    const projectedPay = actualPay(shiftMinutes(s.startTime, s.endTime), rate, s.bonus);
    const entry = s.timeEntries[0];
    return {
      // Agency labor has no clock punch, so it's always the projection.
      actualPay: s.agencyId ? null : entry?.actualPay ?? null,
      projectedPay,
      workedMinutes: entry?.actualMinutes ?? null,
    };
  });

  const scheduled = shifts.length;
  const labor = summarizeLabor(laborLines);
  return {
    facilityId,
    facilityName,
    scheduled,
    confirmed,
    open,
    completed,
    agencyFilled,
    callOffs,
    fillRatePct: fillRate({ scheduled, confirmed, open }),
    labor,
  };
}

/** Aggregate a report across a set of facilities. */
export async function orgReport(
  facilities: { id: string; name: string }[],
  from: Date,
  to: Date
): Promise<OrgReport> {
  const reports = await Promise.all(
    facilities.map((f) => facilityReport(f.id, f.name, from, to))
  );

  const sum = (fn: (r: FacilityReport) => number) => reports.reduce((a, r) => a + fn(r), 0);
  const scheduled = sum((r) => r.scheduled);
  const confirmed = sum((r) => r.confirmed);

  return {
    from,
    to,
    facilities: reports,
    totals: {
      scheduled,
      confirmed,
      open: sum((r) => r.open),
      completed: sum((r) => r.completed),
      agencyFilled: sum((r) => r.agencyFilled),
      callOffs: sum((r) => r.callOffs),
      fillRatePct: pct(confirmed, scheduled),
      laborCost: Math.round(sum((r) => r.labor.totalCost) * 100) / 100,
      hoursWorked: Math.round(sum((r) => r.labor.hoursWorked) * 100) / 100,
    },
  };
}
