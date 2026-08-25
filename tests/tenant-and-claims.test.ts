import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";

async function reset() {
  // Delete in FK-safe order.
  await prisma.callOff.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.templateShift.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.organization.deleteMany();
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("tenant isolation (DB level)", () => {
  it("a corporate admin only sees their own organization's facilities", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A", slug: "org-a" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B", slug: "org-b" } });
    await prisma.facility.create({ data: { name: "A-Facility", organizationId: orgA.id } });
    await prisma.facility.create({ data: { name: "B-Facility", organizationId: orgB.id } });
    const adminA = { role: "CORPORATE", organizationId: orgA.id };

    const visible = await prisma.facility.findMany({ where: orgWhere(adminA) });
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe("A-Facility");
  });
});

describe("atomic shift fill (no double-booking)", () => {
  it("only one of two concurrent approvals can fill the same open shift", async () => {
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-c" } });
    const facility = await prisma.facility.create({ data: { name: "F", organizationId: org.id } });
    const poster = await prisma.user.create({
      data: { email: "p@x.com", name: "Poster", role: "CORPORATE", organizationId: org.id, passwordHash: "x" },
    });
    const w1 = await prisma.user.create({
      data: { email: "w1@x.com", name: "W1", role: "WORKER", organizationId: org.id, facilityId: facility.id, position: "CNA", passwordHash: "x" },
    });
    const w2 = await prisma.user.create({
      data: { email: "w2@x.com", name: "W2", role: "WORKER", organizationId: org.id, facilityId: facility.id, position: "CNA", passwordHash: "x" },
    });
    const shift = await prisma.shift.create({
      data: {
        title: "CNA shift", position: "CNA", facilityId: facility.id, status: "OPEN",
        startTime: new Date("2026-09-01T13:00:00Z"), endTime: new Date("2026-09-01T21:00:00Z"),
        postedById: poster.id,
      },
    });

    // The exact conditional-update the approval route uses: fill only while OPEN.
    const fill = (workerId: string) =>
      prisma.shift.updateMany({
        where: { id: shift.id, status: "OPEN" },
        data: { status: "FILLED", assignedToId: workerId },
      });

    const [r1, r2] = await Promise.all([fill(w1.id), fill(w2.id)]);
    const winners = [r1.count, r2.count].filter((c) => c === 1).length;

    expect(winners).toBe(1); // exactly one approval won
    const after = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(after?.status).toBe("FILLED");
    expect([w1.id, w2.id]).toContain(after?.assignedToId);
  });
});

describe("call-off reopens the shift", () => {
  it("clears the assignment, records the call-off, and reopens to the marketplace", async () => {
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-co" } });
    const facility = await prisma.facility.create({ data: { name: "F", organizationId: org.id } });
    const poster = await prisma.user.create({
      data: { email: "p2@x.com", name: "Poster", role: "CORPORATE", organizationId: org.id, passwordHash: "x" },
    });
    const worker = await prisma.user.create({
      data: { email: "wc@x.com", name: "WC", role: "WORKER", organizationId: org.id, facilityId: facility.id, position: "CNA", passwordHash: "x" },
    });
    const schedule = await prisma.schedule.create({
      data: { facilityId: facility.id, weekStart: new Date("2026-08-31T00:00:00Z"), published: true, publishedAt: new Date() },
    });
    const shift = await prisma.shift.create({
      data: {
        title: "CNA shift", position: "CNA", facilityId: facility.id, scheduleId: schedule.id,
        status: "FILLED", assignedToId: worker.id, postedById: poster.id,
        startTime: new Date("2026-09-02T13:00:00Z"), endTime: new Date("2026-09-02T21:00:00Z"),
      },
    });

    // Mirror the call-off route's core effect (published schedule → OPEN).
    await prisma.$transaction([
      prisma.shift.update({ where: { id: shift.id }, data: { status: "OPEN", assignedToId: null } }),
      prisma.callOff.create({ data: { shiftId: shift.id, workerId: worker.id, recordedById: worker.id, reason: "sick" } }),
    ]);

    const after = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(after?.status).toBe("OPEN");
    expect(after?.assignedToId).toBeNull();

    const callOffs = await prisma.callOff.findMany({ where: { shiftId: shift.id } });
    expect(callOffs).toHaveLength(1);
    expect(callOffs[0].reason).toBe("sick");
    expect(callOffs[0].workerId).toBe(worker.id);
  });
});
