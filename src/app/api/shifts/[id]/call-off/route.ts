import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { notify, notifyFacilityManagers } from "@/lib/notify";
import { callOffSchema } from "@/lib/validation";

// Record a call-off on an assigned shift and reopen it.
//
// Who can call off: the assigned employee themselves, or a scheduler/corporate
// for that facility (calling off on the employee's behalf). The shift returns to
// the marketplace: if it belongs to a published schedule (or is an ad-hoc
// marketplace shift) it becomes OPEN; an unpublished draft shift returns to
// PLANNED so it's simply unassigned again.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = callOffSchema.safeParse(json);
  const reason = parsed.success ? parsed.data.reason || null : null;

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { facility: { select: { organizationId: true } }, schedule: { select: { published: true } } },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!shift.assignedToId) {
    return NextResponse.json({ error: "No one is assigned to this shift." }, { status: 409 });
  }

  const manager = canManage(user);
  const isOwnShift = shift.assignedToId === user.id;
  if (!isOwnShift && !manager) {
    return NextResponse.json({ error: "You can only call off your own shift." }, { status: 403 });
  }
  // Managers acting on someone else's shift must be in the same facility/org.
  if (manager && !isOwnShift) {
    if (!canAccessFacility(user, shift.facilityId) || !sameOrg(user, shift.facility?.organizationId)) {
      return NextResponse.json({ error: "That shift is at a different facility." }, { status: 403 });
    }
  }

  const workerId = shift.assignedToId;
  // Draft (unpublished) schedule shifts go back to PLANNED; everything else
  // (published or ad-hoc) reopens to the marketplace as OPEN.
  const reopenStatus = shift.scheduleId && shift.schedule && !shift.schedule.published ? "PLANNED" : "OPEN";

  const [worker] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: workerId }, select: { name: true } }),
    prisma.shift.update({
      where: { id: shift.id },
      data: { status: reopenStatus, assignedToId: null },
    }),
    prisma.callOff.create({
      data: { shiftId: shift.id, workerId, recordedById: user.id, reason },
    }),
    // Any approved claim by this worker on this shift is now void.
    prisma.claim.updateMany({
      where: { shiftId: shift.id, workerId, status: "APPROVED" },
      data: { status: "WITHDRAWN", decidedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "shift.call_off", entityType: "Shift", entityId: shift.id,
    after: { worker: worker?.name, reason, reopenedAs: reopenStatus, byManager: manager && !isOwnShift },
  });

  // Let the facility's schedulers know coverage just opened back up.
  await notifyFacilityManagers(shift.facilityId, {
    title: reopenStatus === "OPEN" ? "Shift called off — back in marketplace" : "Shift called off",
    body: `${worker?.name ?? "An employee"} called off "${shift.title}"${reason ? ` (${reason})` : ""}.`,
    link: "/coverage",
  });
  // If a manager called it off for the employee, tell the employee.
  if (manager && !isOwnShift) {
    await notify({
      userId: workerId,
      title: "Your shift was cleared",
      body: `"${shift.title}" was called off on your behalf.`,
      link: "/my-shifts",
    });
  }

  return NextResponse.json({ ok: true, reopenedAs: reopenStatus });
}
