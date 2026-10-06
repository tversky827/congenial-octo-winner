import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { claimPoolShift, ClaimError } from "@/lib/poolClaim";
import { approveAssignmentHours } from "@/lib/poolApproval";
import { finalizePayrollPeriod } from "@/lib/payrollFinalize";

async function reset() {
  await prisma.laborCostAllocation.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.callOff.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.templateShift.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.nurseFacilityEligibility.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.organization.deleteMany();
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

// Fixed shift window: Oct 15 2026, 7a–3p UTC = 8 hours.
const SHIFT_START = new Date("2026-10-15T07:00:00Z");
const SHIFT_END = new Date("2026-10-15T15:00:00Z");

async function setup() {
  const org = await prisma.organization.create({ data: { name: "Nurse Pool", slug: "nurse-pool" } });
  const facility = await prisma.facility.create({
    data: { name: "Facility #7", organizationId: org.id, costCenterCode: "F007", glAccount: "Nursing Labor" },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@np.com", name: "Pool Admin", role: "CORPORATE_ADMIN", organizationId: org.id, passwordHash: "x" },
  });
  const jane = await prisma.user.create({
    data: {
      email: "jane@np.com", name: "Jane Smith", role: "POOL_NURSE", organizationId: org.id,
      passwordHash: "x", poolMember: true, facilityId: null, position: "Nurse",
      licenseType: "RN", baseRate: 38,
    },
  });
  await prisma.nurseFacilityEligibility.create({
    data: { nurseId: jane.id, facilityId: facility.id, active: true, orientationComplete: true },
  });
  return { org, facility, admin, jane };
}

async function postShift(facilityId: string, postedById: string, opts: Partial<{ nursesNeeded: number; requiredLicense: string | null }> = {}) {
  return prisma.shift.create({
    data: {
      title: "RN shift", position: "Nurse", facilityId, startTime: SHIFT_START, endTime: SHIFT_END,
      status: "OPEN", nursesNeeded: opts.nursesNeeded ?? 1, requiredLicense: opts.requiredLicense ?? "RN",
      postedById,
    },
  });
}

describe("§46 acceptance — Jane Smith end-to-end", () => {
  it("claim → approve → finalize allocates $304 to Facility #7 while payroll home stays the pool", async () => {
    const { org, facility, admin, jane } = await setup();
    const shift = await postShift(facility.id, admin.id);

    // Jane claims.
    const assignment = await claimPoolShift(jane.id, shift.id);
    expect(assignment.status).toBe("CLAIMED");

    const afterClaim = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(afterClaim?.seatsFilled).toBe(1);
    expect(afterClaim?.status).toBe("FILLED");
    expect(afterClaim?.assignedToId).toBe(jane.id);

    // Facility approves 8 hours.
    await approveAssignmentHours(assignment.id, { id: admin.id, name: admin.name, organizationId: org.id }, 8);

    // Payroll period covering the shift.
    const period = await prisma.payrollPeriod.create({
      data: { organizationId: org.id, startDate: new Date("2026-10-12T00:00:00Z"), endDate: new Date("2026-10-19T00:00:00Z") },
    });

    const result = await finalizePayrollPeriod(period.id, { id: admin.id, name: admin.name, organizationId: org.id });
    expect(result.ok).toBe(true);
    expect(result.reconciliation?.balanced).toBe(true);
    expect(result.reconciliation?.difference).toBe(0);

    // Payroll record: payroll HOME = the pool (nurse's org), gross $304.
    const record = await prisma.payrollRecord.findFirst({ where: { nurseId: jane.id } });
    expect(record?.grossPay).toBe(304);
    expect(record?.regularHours).toBe(8);
    expect(record?.overtimeHours).toBe(0);
    const nurse = await prisma.user.findUnique({ where: { id: jane.id } });
    expect(nurse?.facilityId).toBeNull(); // no employer facility
    expect(nurse?.poolMember).toBe(true);

    // Cost allocation: expense → Facility #7, cost center F007, $304.
    const alloc = await prisma.laborCostAllocation.findFirst({ where: { nurseId: jane.id } });
    expect(alloc?.facilityId).toBe(facility.id);
    expect(alloc?.costCenter).toBe("F007");
    expect(alloc?.totalAllocated).toBe(304);

    // Reconciliation: Σ allocations == payroll.
    const allAllocs = await prisma.laborCostAllocation.findMany({ where: { payrollPeriodId: period.id } });
    const allocTotal = allAllocs.reduce((s, a) => s + a.totalAllocated, 0);
    expect(allocTotal).toBe(304);

    // Audit trail recorded the key events.
    const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
    expect(actions).toContain("pool.claim");
    expect(actions).toContain("pool.approve_hours");
    expect(actions).toContain("payroll.finalize");
  });
});

describe("double-booking prevention", () => {
  it("rejects an overlapping claim", async () => {
    const { facility, admin, jane } = await setup();
    const shiftA = await postShift(facility.id, admin.id);
    await claimPoolShift(jane.id, shiftA.id);

    // Overlapping shift at the same facility (different row, same window).
    const shiftB = await prisma.shift.create({
      data: { title: "RN 2", position: "Nurse", facilityId: facility.id, startTime: SHIFT_START, endTime: SHIFT_END, status: "OPEN", requiredLicense: "RN", postedById: admin.id },
    });
    await expect(claimPoolShift(jane.id, shiftB.id)).rejects.toBeInstanceOf(ClaimError);
  });

  it("allows a non-overlapping claim the next day", async () => {
    const { facility, admin, jane } = await setup();
    const shiftA = await postShift(facility.id, admin.id);
    await claimPoolShift(jane.id, shiftA.id);
    const shiftB = await prisma.shift.create({
      data: { title: "RN next day", position: "Nurse", facilityId: facility.id, startTime: new Date("2026-10-16T07:00:00Z"), endTime: new Date("2026-10-16T15:00:00Z"), status: "OPEN", requiredLicense: "RN", postedById: admin.id },
    });
    const b = await claimPoolShift(jane.id, shiftB.id);
    expect(b.status).toBe("CLAIMED");
  });
});

describe("multi-seat shifts", () => {
  it("fills seats until full, then rejects", async () => {
    const { org, facility, admin } = await setup();
    const shift = await postShift(facility.id, admin.id, { nursesNeeded: 2 });

    const mkNurse = async (n: number) => {
      const u = await prisma.user.create({
        data: { email: `n${n}@np.com`, name: `Nurse ${n}`, role: "POOL_NURSE", organizationId: org.id, passwordHash: "x", poolMember: true, licenseType: "RN", baseRate: 40 },
      });
      await prisma.nurseFacilityEligibility.create({ data: { nurseId: u.id, facilityId: facility.id, active: true, orientationComplete: true } });
      return u;
    };
    const [a, b, c] = await Promise.all([mkNurse(1), mkNurse(2), mkNurse(3)]);

    await claimPoolShift(a.id, shift.id);
    await claimPoolShift(b.id, shift.id);
    const afterTwo = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(afterTwo?.seatsFilled).toBe(2);
    expect(afterTwo?.status).toBe("FILLED");

    await expect(claimPoolShift(c.id, shift.id)).rejects.toThrow(/fully staffed/);
  });
});

describe("eligibility gating", () => {
  it("blocks a facility the nurse isn't eligible for", async () => {
    const { org, admin, jane } = await setup();
    const other = await prisma.facility.create({ data: { name: "Facility #3", organizationId: org.id } });
    const shift = await postShift(other.id, admin.id);
    await expect(claimPoolShift(jane.id, shift.id)).rejects.toThrow(/not approved to work/);
  });

  it("blocks when facility orientation is incomplete", async () => {
    const { org, admin, jane } = await setup();
    const other = await prisma.facility.create({ data: { name: "Facility #2", organizationId: org.id } });
    await prisma.nurseFacilityEligibility.create({ data: { nurseId: jane.id, facilityId: other.id, active: true, orientationComplete: false } });
    const shift = await postShift(other.id, admin.id);
    await expect(claimPoolShift(jane.id, shift.id)).rejects.toThrow(/orientation/);
  });
});
