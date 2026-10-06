import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { eligibilitySchema } from "@/lib/validation";

// Set a pool nurse's eligibility at one facility (upsert active + orientation).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = eligibilitySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const [nurse, facility] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.facility.findUnique({ where: { id: parsed.data.facilityId } }),
  ]);
  if (!nurse) return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
  if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 404 });
  if (!sameOrg(user, nurse.organizationId) || !sameOrg(user, facility.organizationId)) {
    return NextResponse.json({ error: "Different organization" }, { status: 403 });
  }

  const active = parsed.data.active ?? true;
  const orientationComplete = parsed.data.orientationComplete ?? false;

  await prisma.nurseFacilityEligibility.upsert({
    where: { nurseId_facilityId: { nurseId: nurse.id, facilityId: facility.id } },
    update: { active, orientationComplete },
    create: { nurseId: nurse.id, facilityId: facility.id, active, orientationComplete },
  });

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "pool.eligibility_set", entityType: "User", entityId: nurse.id,
    after: { facility: facility.name, active, orientationComplete },
  });
  return NextResponse.json({ ok: true });
}
