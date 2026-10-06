import { prisma } from "./db";
import { audit } from "./audit";
import { getPoolRules } from "./poolSettings";
import { calculateWeek, sumPayroll, type WeekAssignment } from "./payrollEngine";
import { buildAllocation, sumAllocations, reconcile, type Reconciliation } from "./costAllocation";
import { weekStartOf } from "./week";

export interface FinalizeResult {
  ok: boolean;
  reason?: string;
  reconciliation?: Reconciliation;
  nurses: number;
  assignments: number;
  recordsCreated: number;
  allocationsCreated: number;
}

/**
 * Finalize a payroll period: price every approved, not-yet-allocated assignment
 * in the window, write one PayrollRecord per nurse (payroll home = Nurse Pool)
 * and one immutable LaborCostAllocation per assignment (expense → facility), and
 * reconcile. Σ allocations MUST equal Σ payroll gross or the period will not
 * finalize (unless an authorized override is passed and audited).
 *
 * Overtime is split per nurse PER WEEK, so periods longer than a week stay
 * correct. Everything is written in one transaction.
 */
export async function finalizePayrollPeriod(
  periodId: string,
  actor: { id: string; name: string; organizationId: string | null },
  opts: { allowOverride?: boolean } = {}
): Promise<FinalizeResult> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { ok: false, reason: "Period not found", nurses: 0, assignments: 0, recordsCreated: 0, allocationsCreated: 0 };
  if (!["OPEN", "PROCESSING"].includes(period.status)) {
    return { ok: false, reason: `Period is ${period.status}`, nurses: 0, assignments: 0, recordsCreated: 0, allocationsCreated: 0 };
  }

  const rules = await getPoolRules(period.organizationId);

  // Approved assignments in the window not yet tied to a payroll record.
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      approvalStatus: "APPROVED",
      approvedHours: { not: null },
      payrollRecordId: null,
      scheduledStart: { gte: period.startDate, lt: period.endDate },
      facility: { organizationId: period.organizationId },
    },
    include: { facility: { select: { costCenterCode: true } } },
  });

  if (assignments.length === 0) {
    return { ok: false, reason: "No approved assignments to finalize in this period.", nurses: 0, assignments: 0, recordsCreated: 0, allocationsCreated: 0 };
  }

  // Group by nurse, then by week (for correct weekly OT).
  const byNurse = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const arr = byNurse.get(a.nurseId) ?? [];
    arr.push(a);
    byNurse.set(a.nurseId, arr);
  }

  const recordWrites: { nurseId: string; totals: ReturnType<typeof sumPayroll>; assignmentIds: string[] }[] = [];
  const assignmentUpdates: { id: string; regularHours: number; overtimeHours: number; grossPay: number }[] = [];
  const allocationBuilds: Parameters<typeof buildAllocation>[0][] = [];

  for (const [nurseId, list] of byNurse) {
    // Split into weeks.
    const weeks = new Map<number, typeof list>();
    for (const a of list) {
      const wk = weekStartOf(a.scheduledStart).getTime();
      const arr = weeks.get(wk) ?? [];
      arr.push(a);
      weeks.set(wk, arr);
    }

    const pricedAll: { id: string; regularHours: number; overtimeHours: number; regularPay: number; overtimePay: number; differentialPay: number; grossPay: number }[] = [];
    for (const weekList of weeks.values()) {
      const input: WeekAssignment[] = weekList.map((a) => ({
        id: a.id,
        approvedHours: a.approvedHours ?? 0,
        baseRate: a.payRate,
        differentialPerHour: a.differentialPerHour,
      }));
      pricedAll.push(...calculateWeek(input, rules.overtime));
    }

    const totals = sumPayroll(pricedAll);
    recordWrites.push({ nurseId, totals, assignmentIds: list.map((a) => a.id) });

    const facilityOf = new Map(list.map((a) => [a.id, { facilityId: a.facilityId, costCenter: a.facility?.costCenterCode ?? null }]));
    for (const p of pricedAll) {
      assignmentUpdates.push({ id: p.id, regularHours: p.regularHours, overtimeHours: p.overtimeHours, grossPay: p.grossPay });
      const f = facilityOf.get(p.id)!;
      allocationBuilds.push({
        payrollPeriodId: periodId, nurseId, assignmentId: p.id,
        facilityId: f.facilityId, costCenter: f.costCenter,
        regularHours: p.regularHours, overtimeHours: p.overtimeHours,
        regularPay: p.regularPay, overtimePay: p.overtimePay,
        differentialPay: p.differentialPay, grossPay: p.grossPay,
      });
    }
  }

  // Reconcile BEFORE writing: Σ payroll gross vs Σ allocations.
  const payrollTotal = recordWrites.reduce((s, r) => s + r.totals.grossPay, 0);
  const allocations = allocationBuilds.map(buildAllocation);
  const recon = reconcile(payrollTotal, sumAllocations(allocations));
  if (!recon.balanced && !opts.allowOverride) {
    return { ok: false, reason: `Reconciliation failed: payroll ${recon.payrollTotal} vs allocations ${recon.allocatedTotal} (diff ${recon.difference}).`, reconciliation: recon, nurses: byNurse.size, assignments: assignments.length, recordsCreated: 0, allocationsCreated: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const r of recordWrites) {
      const record = await tx.payrollRecord.create({
        data: {
          payrollPeriodId: periodId, nurseId: r.nurseId,
          regularHours: r.totals.regularHours, overtimeHours: r.totals.overtimeHours,
          regularPay: r.totals.regularPay, overtimePay: r.totals.overtimePay,
          differentialPay: r.totals.differentialPay, grossPay: r.totals.grossPay,
        },
      });
      await tx.shiftAssignment.updateMany({ where: { id: { in: r.assignmentIds } }, data: { payrollRecordId: record.id } });
    }
    for (const u of assignmentUpdates) {
      await tx.shiftAssignment.update({ where: { id: u.id }, data: { regularHours: u.regularHours, overtimeHours: u.overtimeHours, grossPay: u.grossPay } });
    }
    for (const a of allocations) {
      // Map explicitly — the Allocation object also carries grossPay, which is a
      // payroll concept, not a ledger column.
      await tx.laborCostAllocation.create({
        data: {
          payrollPeriodId: a.payrollPeriodId, nurseId: a.nurseId, assignmentId: a.assignmentId,
          facilityId: a.facilityId, costCenter: a.costCenter,
          regularHours: a.regularHours, overtimeHours: a.overtimeHours,
          regularPay: a.regularPay, overtimePay: a.overtimePay, differentialPay: a.differentialPay,
          totalAllocated: a.totalAllocated,
        },
      });
    }
    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "APPROVED", finalizedAt: new Date(), finalizedById: actor.id },
    });
  });

  await audit({
    actorId: actor.id, actorName: actor.name, organizationId: period.organizationId,
    action: opts.allowOverride && !recon.balanced ? "payroll.finalize_override" : "payroll.finalize",
    entityType: "PayrollPeriod", entityId: periodId,
    after: { payrollTotal: recon.payrollTotal, allocatedTotal: recon.allocatedTotal, nurses: byNurse.size, assignments: assignments.length },
  });

  return {
    ok: true,
    reconciliation: recon,
    nurses: byNurse.size,
    assignments: assignments.length,
    recordsCreated: recordWrites.length,
    allocationsCreated: allocations.length,
  };
}
