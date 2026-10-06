import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { notifyEligibleNurses } from "@/lib/poolNotify";

async function reset() {
  await prisma.notification.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.nurseFacilityEligibility.deleteMany();
  await prisma.user.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.organization.deleteMany();
}
beforeEach(reset);
afterAll(async () => { await reset(); await prisma.$disconnect(); });

describe("notifyEligibleNurses", () => {
  it("alerts matching eligible+oriented nurses and skips the rest", async () => {
    const org = await prisma.organization.create({ data: { name: "Pool", slug: "p" } });
    const facility = await prisma.facility.create({ data: { name: "Facility A", organizationId: org.id } });
    const other = await prisma.facility.create({ data: { name: "Facility B", organizationId: org.id } });

    const mk = async (email: string, extra: Record<string, unknown>) =>
      prisma.user.create({ data: { email, name: email, role: "POOL_NURSE", organizationId: org.id, passwordHash: "x", poolMember: true, licenseType: "RN", baseRate: 40, ...extra } });

    const match = await mk("match@x.com", {});                                   // eligible, no prefs → notified
    const lowPay = await mk("low@x.com", { prefMinRate: 50 });                     // wants >= $50 → skipped
    const wrongLicense = await mk("lpn@x.com", { licenseType: "LPN" });            // license mismatch → skipped
    const notOriented = await mk("neworient@x.com", {});                           // eligible but not oriented → skipped
    const prefOther = await mk("other@x.com", { prefFacilityIds: JSON.stringify([other.id]) }); // prefers B → skipped

    for (const n of [match, lowPay, wrongLicense, prefOther]) {
      await prisma.nurseFacilityEligibility.create({ data: { nurseId: n.id, facilityId: facility.id, active: true, orientationComplete: true } });
    }
    await prisma.nurseFacilityEligibility.create({ data: { nurseId: notOriented.id, facilityId: facility.id, active: true, orientationComplete: false } });

    const poster = await mk("admin@x.com", { role: "CORPORATE_ADMIN", poolMember: false });
    const shift = await prisma.shift.create({
      data: {
        title: "RN pool shift", position: "Nurse", facilityId: facility.id, requiredLicense: "RN",
        startTime: new Date("2026-10-21T07:00:00Z"), endTime: new Date("2026-10-21T15:00:00Z"),
        status: "OPEN", nursesNeeded: 1, postedById: poster.id,
      },
    });

    const count = await notifyEligibleNurses(shift.id);
    expect(count).toBe(1);

    const notified = await prisma.notification.findMany({ select: { userId: true } });
    expect(notified.map((n) => n.userId)).toEqual([match.id]);
  });
});
