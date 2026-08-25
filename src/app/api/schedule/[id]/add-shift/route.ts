import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { addShiftSchema } from "@/lib/validation";
import { combineDayTime } from "@/lib/week";

// Admin-only day override: add an extra shift to one day of a schedule.
// Schedulers can't change a day's shifts — only corporate can.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Only corporate can change a day's shifts" }, { status: 403 });
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  if (!sameOrg(user, schedule.facility?.organizationId)) {
    return NextResponse.json({ error: "Out of your scope" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = addShiftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const start = combineDayTime(schedule.weekStart, d.dayOffset, d.startTime);
  let end = combineDayTime(schedule.weekStart, d.dayOffset, d.endTime);
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  const shift = await prisma.shift.create({
    data: {
      title: `${d.position} shift`,
      position: d.position,
      facilityId: schedule.facilityId,
      scheduleId: schedule.id,
      startTime: start,
      endTime: end,
      bonus: d.bonus,
      // If the week is already live, an added shift goes straight to the marketplace.
      status: schedule.published ? "OPEN" : "PLANNED",
      postedById: user.id,
    },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "shift.create", entityType: "Shift", entityId: shift.id,
    after: { position: d.position, scheduleId: schedule.id, dayOffset: d.dayOffset },
  });
  return NextResponse.json({ id: shift.id });
}
