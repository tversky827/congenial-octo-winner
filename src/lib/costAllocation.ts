// CostAllocationService + ReconciliationService — pure.
//
// Every approved assignment's pay is allocated to the FACILITY where it was
// worked, while the nurse's payroll home stays the Nurse Pool. The allocation
// is derived from the same per-assignment pay the payroll record is built from,
// so Σ allocations == Σ payroll by construction; reconciliation then catches any
// manual adjustment or drift before a period can be finalized.

import { round2, type AssignmentPay } from "./payrollEngine";

export interface AllocationInput extends AssignmentPay {
  payrollPeriodId: string;
  nurseId: string;
  assignmentId: string;
  facilityId: string;
  costCenter: string | null;
}

export interface Allocation extends AllocationInput {
  totalAllocated: number;
}

/** Build one immutable labor-cost-allocation row for an approved assignment. */
export function buildAllocation(input: AllocationInput): Allocation {
  const totalAllocated = round2(input.regularPay + input.overtimePay + input.differentialPay);
  return { ...input, totalAllocated };
}

export function sumAllocations(allocations: { totalAllocated: number }[]): number {
  return round2(allocations.reduce((a, x) => a + x.totalAllocated, 0));
}

/** Group allocations into a facility-cost report (cost by facility). */
export interface FacilityCostLine {
  facilityId: string;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  differentialPay: number;
  totalLabor: number;
}

export function costByFacility(allocations: Allocation[]): FacilityCostLine[] {
  const map = new Map<string, FacilityCostLine>();
  for (const a of allocations) {
    const line =
      map.get(a.facilityId) ??
      { facilityId: a.facilityId, regularHours: 0, overtimeHours: 0, regularPay: 0, overtimePay: 0, differentialPay: 0, totalLabor: 0 };
    line.regularHours = round2(line.regularHours + a.regularHours);
    line.overtimeHours = round2(line.overtimeHours + a.overtimeHours);
    line.regularPay = round2(line.regularPay + a.regularPay);
    line.overtimePay = round2(line.overtimePay + a.overtimePay);
    line.differentialPay = round2(line.differentialPay + a.differentialPay);
    line.totalLabor = round2(line.totalLabor + a.totalAllocated);
    map.set(a.facilityId, line);
  }
  return [...map.values()].sort((a, b) => b.totalLabor - a.totalLabor);
}

export interface Reconciliation {
  payrollTotal: number;
  allocatedTotal: number;
  difference: number;
  balanced: boolean;
}

// Half a cent tolerance absorbs floating-point noise; anything larger is a real
// discrepancy that must block finalizing the period.
const TOLERANCE = 0.005;

export function reconcile(payrollTotal: number, allocatedTotal: number): Reconciliation {
  const difference = round2(payrollTotal - allocatedTotal);
  return {
    payrollTotal: round2(payrollTotal),
    allocatedTotal: round2(allocatedTotal),
    difference,
    balanced: Math.abs(payrollTotal - allocatedTotal) < TOLERANCE,
  };
}
