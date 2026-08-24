import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { generateWeekSchema } from "@/lib/validation";
import { parseWeekStart, combineDayTime } from "@/lib/week";

// Build a week's draft (PLANNED) shifts for a facility from its staffing template.
// Idempotent-ish: won't duplicate if the week already has shifts.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Schedulers only" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = generateWeekSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { facilityId } = parsed.data;
  if (!canAccessFacility(user, facilityId)) {
    return NextResponse.json({ error: "That facility is out of your scope" }, { status: 403 });
  }
  const weekStart = parseWeekStart(parsed.data.weekStart);

  // Find or create the schedule for this facility + week.
  const schedule = await prisma.schedule.upsert({
    where: { facilityId_weekStart: { facilityId, weekStart } },
    update: {},
    create: { facilityId, weekStart },
  });

  const existingCount = await prisma.shift.count({ where: { scheduleId: schedule.id } });
  if (existingCount > 0) {
    return NextResponse.json({ scheduleId: schedule.id, created: 0, message: "Week already built" });
  }

  const template = await prisma.templateShift.findMany({
    where: { facilityId, active: true },
  });
  if (template.length === 0) {
    return NextResponse.json(
      { error: "No staffing template for this facility yet. Add one in Admin → Coverage." },
      { status: 400 }
    );
  }

  const data = [] as {
    title: string;
    position: string;
    facilityId: string;
    startTime: Date;
    endTime: Date;
    bonus: number;
    status: string;
    scheduleId: string;
    postedById: string;
  }[];

  for (const t of template) {
    for (let i = 0; i < t.count; i++) {
      const start = combineDayTime(weekStart, t.dayOfWeek, t.startTime);
      let end = combineDayTime(weekStart, t.dayOfWeek, t.endTime);
      if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      data.push({
        title: `${t.position} shift`,
        position: t.position,
        facilityId,
        startTime: start,
        endTime: end,
        bonus: t.bonus,
        status: "PLANNED",
        scheduleId: schedule.id,
        postedById: user.id,
      });
    }
  }

  await prisma.shift.createMany({ data });
  return NextResponse.json({ scheduleId: schedule.id, created: data.length });
}
