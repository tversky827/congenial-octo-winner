import { prisma } from "./db";
import { combineDayTime } from "./week";

export interface BuildResult {
  scheduleId: string;
  created: number;
  alreadyBuilt: boolean;
  noTemplate: boolean;
}

/**
 * Build a facility's week of draft (PLANNED) shifts from its daily staffing
 * template. Idempotent: if the week already has shifts it does nothing. Shared
 * by the scheduler's "Build week" action and the default-coverage importer.
 */
export async function buildWeekFromTemplate(
  facilityId: string,
  weekStart: Date,
  postedById: string
): Promise<BuildResult> {
  const schedule = await prisma.schedule.upsert({
    where: { facilityId_weekStart: { facilityId, weekStart } },
    update: {},
    create: { facilityId, weekStart },
  });

  const existingCount = await prisma.shift.count({ where: { scheduleId: schedule.id } });
  if (existingCount > 0) {
    return { scheduleId: schedule.id, created: 0, alreadyBuilt: true, noTemplate: false };
  }

  const template = await prisma.templateShift.findMany({ where: { facilityId, active: true } });
  if (template.length === 0) {
    return { scheduleId: schedule.id, created: 0, alreadyBuilt: false, noTemplate: true };
  }

  const data = [];
  // The template is a DAILY budget — apply every entry to all 7 days.
  for (let day = 0; day < 7; day++) {
    for (const t of template) {
      for (let i = 0; i < t.count; i++) {
        const start = combineDayTime(weekStart, day, t.startTime);
        let end = combineDayTime(weekStart, day, t.endTime);
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
          postedById,
        });
      }
    }
  }

  await prisma.shift.createMany({ data });
  return { scheduleId: schedule.id, created: data.length, alreadyBuilt: false, noTemplate: false };
}
