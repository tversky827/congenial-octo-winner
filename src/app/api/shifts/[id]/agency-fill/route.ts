import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { agencyFillSchema } from "@/lib/validation";

// Fill a shift with a staffing agency (scheduler/corporate). Clears any employee
// assignment and marks the shift FILLED with the agency. Passing agencyId=""
// via DELETE-style is not used; to un-agency, reassign or reopen elsewhere.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) {
    return NextResponse.json({ error: "Only schedulers can fill with an agency" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = agencyFillSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!canAccessFacility(user, shift.facilityId) || !sameOrg(user, shift.facility?.organizationId)) {
    return NextResponse.json({ error: "That shift is at a different facility" }, { status: 403 });
  }

  const agency = await prisma.agency.findUnique({ where: { id: parsed.data.agencyId } });
  if (!agency || !agency.active || !sameOrg(user, agency.organizationId)) {
    return NextResponse.json({ error: "Agency not found" }, { status: 400 });
  }

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: "FILLED",
      assignedToId: null,
      agencyId: agency.id,
      agencyWorkerName: parsed.data.workerName || null,
    },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "shift.agency_fill", entityType: "Shift", entityId: shift.id,
    after: { agency: agency.name, worker: updated.agencyWorkerName },
  });
  return NextResponse.json({ ok: true });
}
