import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { name, email, password, position, accessType, facilityId, managementCode } = parsed.data;

  // MANAGER and CORPORATE accounts require the management code.
  if (accessType === "MANAGER" || accessType === "CORPORATE") {
    if (!managementCode || managementCode.trim() !== process.env.MANAGER_INVITE_CODE) {
      return NextResponse.json({ error: "Invalid management code" }, { status: 400 });
    }
  }

  // WORKER and MANAGER must belong to a real facility; they inherit its org.
  let resolvedFacilityId: string | null = null;
  let resolvedOrgId: string | null = null;
  if (accessType === "WORKER" || accessType === "MANAGER") {
    if (!facilityId) {
      return NextResponse.json({ error: "Please choose your facility" }, { status: 400 });
    }
    const facility = await prisma.facility.findFirst({ where: { id: facilityId, active: true } });
    if (!facility) {
      return NextResponse.json({ error: "That facility no longer exists" }, { status: 400 });
    }
    resolvedFacilityId = facility.id;
    resolvedOrgId = facility.organizationId;
  } else if (accessType === "CORPORATE") {
    // Corporate joins the single existing organization if there is exactly one;
    // otherwise they'll create/claim one via the setup flow.
    const orgs = await prisma.organization.findMany({ take: 2, select: { id: true } });
    resolvedOrgId = orgs.length === 1 ? orgs[0].id : null;
  }

  // Staff must pick their role (CNA or Nurse) — it decides which shifts they see.
  if (accessType === "WORKER" && !position) {
    return NextResponse.json({ error: "Please choose your role (CNA or Nurse)" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      position: position || null,
      role: accessType,
      facilityId: resolvedFacilityId,
      organizationId: resolvedOrgId,
    },
  });

  await audit({
    actorId: user.id,
    actorName: user.name,
    organizationId: user.organizationId,
    action: "user.register",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, role: user.role, facilityId: user.facilityId },
  });

  await createSession(user);
  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
