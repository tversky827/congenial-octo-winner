import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { departmentCreateSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  if (!user.organizationId) return NextResponse.json({ departments: [] });
  const departments = await prisma.department.findMany({
    where: { organizationId: user.organizationId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ departments });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: "Set up your organization first." }, { status: 400 });
  }
  const json = await req.json().catch(() => null);
  const parsed = departmentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const existing = await prisma.department.findFirst({
    where: { organizationId: user.organizationId, name: parsed.data.name },
  });
  if (existing) return NextResponse.json({ error: "That department already exists" }, { status: 409 });

  const dept = await prisma.department.create({
    data: { organizationId: user.organizationId, name: parsed.data.name },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "department.create", entityType: "Department", entityId: dept.id, after: { name: dept.name },
  });
  return NextResponse.json({ id: dept.id });
}
