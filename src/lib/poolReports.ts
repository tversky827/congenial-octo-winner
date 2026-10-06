import { prisma } from "./db";
import { costByFacility, reconcile, type Reconciliation, type FacilityCostLine } from "./costAllocation";

export interface CostByFacilityReport {
  facilities: (FacilityCostLine & { facilityName: string })[];
  totals: { regularHours: number; overtimeHours: number; totalLabor: number };
}

/** Nurse Pool labor cost grouped by facility, read from the allocation ledger. */
export async function costByFacilityReport(
  organizationId: string,
  from: Date,
  to: Date
): Promise<CostByFacilityReport> {
  const allocations = await prisma.laborCostAllocation.findMany({
    where: {
      payrollPeriod: { organizationId },
      assignment: { scheduledStart: { gte: from, lt: to } },
    },
    include: { facility: { select: { name: true } } },
  });

  const lines = costByFacility(
    allocations.map((a) => ({
      payrollPeriodId: a.payrollPeriodId, nurseId: a.nurseId, assignmentId: a.assignmentId,
      facilityId: a.facilityId, costCenter: a.costCenter,
      regularHours: a.regularHours, overtimeHours: a.overtimeHours,
      regularPay: a.regularPay, overtimePay: a.overtimePay, differentialPay: a.differentialPay,
      grossPay: a.totalAllocated, totalAllocated: a.totalAllocated,
    }))
  );

  const nameOf = new Map(allocations.map((a) => [a.facilityId, a.facility?.name ?? "—"]));
  const facilities = lines.map((l) => ({ ...l, facilityName: nameOf.get(l.facilityId) ?? "—" }));
  const totals = facilities.reduce(
    (acc, f) => ({
      regularHours: Math.round((acc.regularHours + f.regularHours) * 100) / 100,
      overtimeHours: Math.round((acc.overtimeHours + f.overtimeHours) * 100) / 100,
      totalLabor: Math.round((acc.totalLabor + f.totalLabor) * 100) / 100,
    }),
    { regularHours: 0, overtimeHours: 0, totalLabor: 0 }
  );
  return { facilities, totals };
}

export interface PeriodReconciliation extends Reconciliation {
  periodId: string;
  byFacility: { facilityId: string; facilityName: string; totalLabor: number }[];
}

/** Reconcile one payroll period: Σ payroll records vs Σ allocations. */
export async function reconcilePeriod(periodId: string): Promise<PeriodReconciliation | null> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) return null;

  const [records, allocations] = await Promise.all([
    prisma.payrollRecord.findMany({ where: { payrollPeriodId: periodId }, select: { grossPay: true } }),
    prisma.laborCostAllocation.findMany({
      where: { payrollPeriodId: periodId },
      include: { facility: { select: { name: true } } },
    }),
  ]);

  const payrollTotal = records.reduce((s, r) => s + r.grossPay, 0);
  const allocatedTotal = allocations.reduce((s, a) => s + a.totalAllocated, 0);

  const byFacilityMap = new Map<string, { facilityId: string; facilityName: string; totalLabor: number }>();
  for (const a of allocations) {
    const cur = byFacilityMap.get(a.facilityId) ?? { facilityId: a.facilityId, facilityName: a.facility?.name ?? "—", totalLabor: 0 };
    cur.totalLabor = Math.round((cur.totalLabor + a.totalAllocated) * 100) / 100;
    byFacilityMap.set(a.facilityId, cur);
  }

  return {
    periodId,
    ...reconcile(payrollTotal, allocatedTotal),
    byFacility: [...byFacilityMap.values()].sort((a, b) => b.totalLabor - a.totalLabor),
  };
}
