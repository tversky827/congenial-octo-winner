import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { positionCreateSchema } from "@/lib/validation";

// List positions. With ?facilityId= it's public (used by the sign-up screen to
// show that facility's roles); otherwise it returns the signed-in corporate
// admin's own organization positions.
export async function GET(req: Request) {
  const facilityId = new URL(req.url).searchParams.get("facilityId");

  if (facilityId) {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { organizationId: true },
    });
    if (!facility?.organizationId) return NextResponse.json({ positions: [] });
    const positions = await prisma.position.findMany({
      where: { organizationId: facility.organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ positions });
  }

  const user = await getCurrentUser();
  if (!user || !isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  const positions = await prisma.position.findMany({
    where: { organizationId: user.organizationId ?? undefined, active: true },
    orderBy: { name: "asc" },
    include: { department: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ positions: user.organizationId ? positions : [] });
}

// Create a position (corporate only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: "Set up your organization first." }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = positionCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, departmentId, licensed } = parsed.data;

  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept || dept.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
  }

  const existing = await prisma.position.findFirst({
    where: { organizationId: user.organizationId, name },
  });
  if (existing) {
    return NextResponse.json({ error: "That position already exists" }, { status: 409 });
  }

  const position = await prisma.position.create({
    data: {
      organizationId: user.organizationId,
      name,
      departmentId: departmentId || null,
      licensed: !!licensed,
    },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "position.create", entityType: "Position", entityId: position.id, after: { name, licensed },
  });
  return NextResponse.json({ id: position.id });
}
