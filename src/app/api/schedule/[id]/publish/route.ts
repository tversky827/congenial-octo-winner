import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { notifyFacilityManagers } from "@/lib/notify";

// Publish a week: every still-empty (PLANNED) shift opens to the marketplace;
// assigned shifts stay assigned and become visible to those employees.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Schedulers only" }, { status: 403 });

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  if (!canAccessFacility(user, schedule.facilityId) || !sameOrg(user, schedule.facility?.organizationId)) {
    return NextResponse.json({ error: "Out of your scope" }, { status: 403 });
  }

  const [, openedResult, assigned] = await prisma.$transaction([
    prisma.schedule.update({
      where: { id: schedule.id },
      data: { published: true, publishedAt: new Date() },
    }),
    prisma.shift.updateMany({
      where: { scheduleId: schedule.id, status: "PLANNED" },
      data: { status: "OPEN" },
    }),
    prisma.shift.findMany({
      where: { scheduleId: schedule.id, status: "ASSIGNED", assignedToId: { not: null } },
      select: { assignedToId: true, title: true },
    }),
  ]);

  // Tell assigned employees their schedule is live.
  await Promise.all(
    assigned.map((s) =>
      s.assignedToId
        ? prisma.notification.create({
            data: {
              userId: s.assignedToId,
              title: "Your schedule is posted",
              body: `You're scheduled for a ${s.title}. See My Shifts.`,
              link: "/my-shifts",
            },
          })
        : Promise.resolve()
    )
  );

  await notifyFacilityManagers(schedule.facilityId, {
    title: "Schedule published",
    body: `${openedResult.count} open shift${openedResult.count === 1 ? "" : "s"} went to the marketplace.`,
    link: "/schedule",
  });

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "schedule.publish", entityType: "Schedule", entityId: schedule.id,
    after: { opened: openedResult.count },
  });

  return NextResponse.json({ ok: true, opened: openedResult.count });
}
