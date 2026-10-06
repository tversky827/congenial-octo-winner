import { describe, it, expect } from "vitest";
import { calculateWeek, sumPayroll } from "@/lib/payrollEngine";
import { buildAllocation, sumAllocations, costByFacility, reconcile } from "@/lib/costAllocation";

describe("buildAllocation", () => {
  it("totals regular + OT + differential and preserves the facility link", () => {
    const a = buildAllocation({
      payrollPeriodId: "p1", nurseId: "jane", assignmentId: "asg1", facilityId: "f7", costCenter: "F007",
      regularHours: 8, overtimeHours: 0, regularPay: 304, overtimePay: 0, differentialPay: 0, grossPay: 304,
    });
    expect(a.facilityId).toBe("f7");
    expect(a.totalAllocated).toBe(304);
  });
});

describe("costByFacility", () => {
  it("groups allocations by facility, worst cost first", () => {
    const allocs = [
      buildAllocation({ payrollPeriodId: "p", nurseId: "n1", assignmentId: "a1", facilityId: "f1", costCenter: null, regularHours: 8, overtimeHours: 0, regularPay: 160, overtimePay: 0, differentialPay: 0, grossPay: 160 }),
      buildAllocation({ payrollPeriodId: "p", nurseId: "n2", assignmentId: "a2", facilityId: "f7", costCenter: null, regularHours: 8, overtimeHours: 0, regularPay: 304, overtimePay: 0, differentialPay: 0, grossPay: 304 }),
      buildAllocation({ payrollPeriodId: "p", nurseId: "n3", assignmentId: "a3", facilityId: "f1", costCenter: null, regularHours: 4, overtimeHours: 0, regularPay: 80, overtimePay: 0, differentialPay: 0, grossPay: 80 }),
    ];
    const lines = costByFacility(allocs);
    expect(lines[0]).toMatchObject({ facilityId: "f7", totalLabor: 304 });
    expect(lines[1]).toMatchObject({ facilityId: "f1", totalLabor: 240, regularHours: 12 });
  });
});

describe("reconcile", () => {
  it("balances when payroll equals allocations", () => {
    const r = reconcile(125000, 125000);
    expect(r.balanced).toBe(true);
    expect(r.difference).toBe(0);
  });
  it("flags a discrepancy", () => {
    const r = reconcile(125000, 124800);
    expect(r.balanced).toBe(false);
    expect(r.difference).toBe(200);
  });
  it("tolerates sub-cent floating point noise", () => {
    expect(reconcile(304.001, 304).balanced).toBe(true);
  });
});

describe("invariant: Σ allocations == Σ payroll", () => {
  it("holds for a mixed week of multiple nurses across facilities", () => {
    // Two nurses, several assignments, some crossing into OT.
    const janeWeek = calculateWeek([
      { id: "j-f1", approvedHours: 36, baseRate: 40, differentialPerHour: 2 },
      { id: "j-f7", approvedHours: 12, baseRate: 40 }, // pushes into OT
    ]);
    const samWeek = calculateWeek([
      { id: "s-f3", approvedHours: 8, baseRate: 38 },
      { id: "s-f2", approvedHours: 8, baseRate: 44 },
    ]);

    const payrollTotal = sumPayroll(janeWeek).grossPay + sumPayroll(samWeek).grossPay;

    const facilityOf: Record<string, string> = {
      "j-f1": "f1", "j-f7": "f7", "s-f3": "f3", "s-f2": "f2",
    };
    const allocations = [...janeWeek, ...samWeek].map((item) =>
      buildAllocation({
        payrollPeriodId: "p", nurseId: item.id.startsWith("j") ? "jane" : "sam",
        assignmentId: item.id, facilityId: facilityOf[item.id], costCenter: null,
        regularHours: item.regularHours, overtimeHours: item.overtimeHours,
        regularPay: item.regularPay, overtimePay: item.overtimePay,
        differentialPay: item.differentialPay, grossPay: item.grossPay,
      })
    );

    const allocatedTotal = sumAllocations(allocations);
    expect(reconcile(payrollTotal, allocatedTotal).balanced).toBe(true);
  });
});
