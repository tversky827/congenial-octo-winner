import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { poolShiftCreateSchema } from "@/lib/validation";
import { notifyEligibleNurses } from "@/lib/poolNotify";

// Post a pool shift (facility admin / corporate). Creates an OPEN shift with a
// required license + seats, then alerts matching eligible pool nurses.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "shift.create")) {
    return NextResponse.json({ error: "Not allowed to post shifts" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = poolShiftCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const facility = await prisma.facility.findUnique({ where: { id: d.facilityId }, select: { organizationId: true } });
  if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 404 });
  if (!canAccessFacility(user, d.facilityId) || !sameOrg(user, facility.organizationId)) {
    return NextResponse.json({ error: "That facility is out of your scope" }, { status: 403 });
  }

  const shift = await prisma.shift.create({
    data: {
      title: `${d.requiredLicense} pool shift`,
      position: "Nurse",
      requiredLicense: d.requiredLicense,
      facilityId: d.facilityId,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      breakMinutes: d.breakMinutes,
      nursesNeeded: d.nursesNeeded,
      differentialPerHour: d.differentialPerHour,
      notes: d.notes || null,
      status: "OPEN",
      postedById: user.id,
    },
  });

  const notified = await notifyEligibleNurses(shift.id).catch(() => 0);
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "pool.shift_post", entityType: "Shift", entityId: shift.id,
    after: { facilityId: d.facilityId, requiredLicense: d.requiredLicense, nursesNeeded: d.nursesNeeded, notified },
  });

  return NextResponse.json({ id: shift.id, notified });
}
