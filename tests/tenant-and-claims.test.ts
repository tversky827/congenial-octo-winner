import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";

async function reset() {
  // Delete in FK-safe order.
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
