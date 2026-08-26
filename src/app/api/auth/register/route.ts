import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { isAllowedPosition } from "@/lib/positionsServer";

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

  // Staff must pick their role — it decides which shifts they see, and it must be
  // one the facility's organization actually offers.
  if (accessType === "WORKER") {
    if (!position) {
      return NextResponse.json({ error: "Please choose your role" }, { status: 400 });
    }
    if (!(await isAllowedPosition(resolvedOrgId, position))) {
      return NextResponse.json({ error: "That role isn't offered at this facility" }, { status: 400 });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Claim path: an imported (Paycor) account that hasn't set a password yet
    // can be activated here by its owner — set the password and sign them in.
    // Their facility/position/rate stay as synced from Paycor.
    if (existing.mustSetPassword && existing.role === "WORKER") {
      const claimed = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: await hashPassword(password),
          mustSetPassword: false,
          name: existing.name || name,
        },
      });
      await audit({
        actorId: claimed.id, actorName: claimed.name, organizationId: claimed.organizationId,
        action: "user.claim_account", entityType: "User", entityId: claimed.id,
        after: { email: claimed.email },
      });
      await createSession(claimed);
      return NextResponse.json({ id: claimed.id, name: claimed.name, role: claimed.role });
    }
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
