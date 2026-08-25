import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { isAllowedPosition } from "@/lib/positionsServer";
import { userUpdateSchema } from "@/lib/validation";

// Change a person's role / facility / active state (corporate only).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(me)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  // Guard against locking yourself out.
  if (params.id === me.id) {
    return NextResponse.json({ error: "You can't change your own access here" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!sameOrg(me, target.organizationId)) {
    return NextResponse.json({ error: "That person is in a different organization" }, { status: 403 });
  }
  if (parsed.data.position && !(await isAllowedPosition(target.organizationId, parsed.data.position))) {
    return NextResponse.json({ error: "That role isn't configured for your organization" }, { status: 400 });
  }

  const role = parsed.data.role ?? (target.role as "CORPORATE" | "MANAGER" | "WORKER");
  // Corporate users have no facility; workers and managers must have one.
  let facilityId: string | null = target.facilityId;
  if (parsed.data.facilityId !== undefined) facilityId = parsed.data.facilityId;
  if (role === "CORPORATE") {
    facilityId = null;
  } else if (!facilityId) {
    return NextResponse.json(
      { error: "Workers and schedulers must be assigned to a facility" },
      { status: 400 }
    );
  }

  if (facilityId) {
    const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 400 });
    if (!sameOrg(me, facility.organizationId)) {
      return NextResponse.json({ error: "That facility is in a different organization" }, { status: 403 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      role,
      facilityId,
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.baseRate !== undefined ? { baseRate: parsed.data.baseRate } : {}),
      ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
    },
  });

  await audit({
    actorId: me.id,
    actorName: me.name,
    organizationId: me.organizationId,
    action: "user.update",
    entityType: "User",
    entityId: updated.id,
    before: { role: target.role, facilityId: target.facilityId, baseRate: target.baseRate, position: target.position, active: target.active },
    after: { role: updated.role, facilityId: updated.facilityId, baseRate: updated.baseRate, position: updated.position, active: updated.active },
  });

  return NextResponse.json({ id: updated.id, role: updated.role, facilityId: updated.facilityId });
}
