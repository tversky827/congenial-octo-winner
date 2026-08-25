import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  orgPositionNames,
  isAllowedPosition,
  orgPositionNamesOrDefault,
} from "@/lib/positionsServer";
import { DEFAULT_POSITIONS } from "@/lib/positions";

async function reset() {
  await prisma.claim.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.templateShift.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  await prisma.organization.deleteMany();
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("configurable positions (per org)", () => {
  it("lists only the org's own active positions", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "pa" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "pb" } });
    await prisma.position.create({ data: { organizationId: orgA.id, name: "CNA" } });
    await prisma.position.create({ data: { organizationId: orgA.id, name: "Nurse" } });
    await prisma.position.create({ data: { organizationId: orgB.id, name: "Cook" } });

    expect(await orgPositionNames(orgA.id)).toEqual(["CNA", "Nurse"]);
    expect(await orgPositionNames(orgB.id)).toEqual(["Cook"]);
  });

  it("excludes retired (inactive) positions", async () => {
    const org = await prisma.organization.create({ data: { name: "A", slug: "pc" } });
    await prisma.position.create({ data: { organizationId: org.id, name: "CNA" } });
    await prisma.position.create({ data: { organizationId: org.id, name: "Med Tech", active: false } });

    expect(await orgPositionNames(org.id)).toEqual(["CNA"]);
  });

  it("allows any position when the org has none configured (migration-safe)", async () => {
    const org = await prisma.organization.create({ data: { name: "A", slug: "pd" } });
    expect(await isAllowedPosition(org.id, "Anything")).toBe(true);
    expect(await orgPositionNamesOrDefault(org.id)).toEqual([...DEFAULT_POSITIONS]);
  });

  it("rejects a position outside the org's configured list once set", async () => {
    const org = await prisma.organization.create({ data: { name: "A", slug: "pe" } });
    await prisma.position.create({ data: { organizationId: org.id, name: "CNA" } });

    expect(await isAllowedPosition(org.id, "CNA")).toBe(true);
    expect(await isAllowedPosition(org.id, "Nurse")).toBe(false);
  });

  it("a null-org (transitional) tenant has no configured positions but still gets defaults", async () => {
    expect(await orgPositionNames(null)).toEqual([]);
    expect(await isAllowedPosition(null, "CNA")).toBe(true);
    expect(await orgPositionNamesOrDefault(null)).toEqual([...DEFAULT_POSITIONS]);
  });
});
