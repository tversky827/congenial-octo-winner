import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { weekStartOf, combineDayTime } from "../src/lib/week";
import { DEFAULT_FACILITY_BUDGET, budgetToRows, facilitySlug } from "../src/lib/defaultCoverage";

const prisma = new PrismaClient();

// Demo password for every seeded account. Change these after first login.
const DEMO_PASSWORD = "password123";

// Build a shift's start/end within the current week (dayOffset: 0=Mon…6=Sun).
function slot(weekStart: Date, dayOffset: number, start: string, end: string) {
  const startTime = combineDayTime(weekStart, dayOffset, start);
  let endTime = combineDayTime(weekStart, dayOffset, end);
  if (endTime.getTime() <= startTime.getTime()) endTime = new Date(endTime.getTime() + 86400000);
  return { startTime, endTime };
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // The tenant / organization everything belongs to.
  const org = await prisma.organization.upsert({
    where: { slug: "goldwater-care" },
    update: {},
    create: { name: "Goldwater Care", slug: "goldwater-care" },
  });

  // The org's clinical department and the two staff positions it employs.
  const nursing = await prisma.department.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Nursing" } },
    update: {},
    create: { organizationId: org.id, name: "Nursing" },
  });
  await prisma.position.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "CNA" } },
    update: { departmentId: nursing.id, licensed: false, active: true },
    create: { organizationId: org.id, departmentId: nursing.id, name: "CNA", licensed: false },
  });
  await prisma.position.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Nurse" } },
    update: { departmentId: nursing.id, licensed: true, active: true, requiredCredential: "RN License" },
    create: { organizationId: org.id, departmentId: nursing.id, name: "Nurse", licensed: true, requiredCredential: "RN License" },
  });

  // Facilities (each has its own shift board).
  const sunrise = await prisma.facility.upsert({
    where: { id: "seed-sunrise" },
    update: { organizationId: org.id },
    create: { id: "seed-sunrise", name: "Sunrise House", address: "120 Elm St", organizationId: org.id },
  });
  const main = await prisma.facility.upsert({
    where: { id: "seed-main" },
    update: { organizationId: org.id },
    create: { id: "seed-main", name: "Goldwater Main", address: "500 Center Ave", organizationId: org.id },
  });

  // Corporate oversight account (sees all facilities in the org).
  const corporate = await prisma.user.upsert({
    where: { email: "corporate@goldwatercare.com" },
    update: { organizationId: org.id },
    create: {
      email: "corporate@goldwatercare.com",
      name: "Corporate Admin",
      role: "CORPORATE",
      organizationId: org.id,
      passwordHash,
    },
  });

  // A facility scheduler for each site.
  await prisma.user.upsert({
    where: { email: "sunrise.manager@goldwatercare.com" },
    update: { organizationId: org.id },
    create: {
      email: "sunrise.manager@goldwatercare.com",
      name: "Morgan (Sunrise)",
      role: "MANAGER",
      organizationId: org.id,
      facilityId: sunrise.id,
      position: "Scheduler",
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "main.manager@goldwatercare.com" },
    update: { organizationId: org.id },
    create: {
      email: "main.manager@goldwatercare.com",
      name: "Alex (Main)",
      role: "MANAGER",
      organizationId: org.id,
      facilityId: main.id,
      position: "Scheduler",
      passwordHash,
    },
  });

  // Staff, each tied to one facility.
  const sam = await prisma.user.upsert({
    where: { email: "sam@goldwatercare.com" },
    update: {},
    create: {
      email: "sam@goldwatercare.com",
      name: "Sam Rivera",
      role: "WORKER",
      organizationId: org.id,
      facilityId: main.id,
      position: "Nurse",
      baseRate: 40,
      passwordHash,
    },
  });
  // Sam holds a valid RN license (so they clear the Nurse credential gate).
  if ((await prisma.credential.count({ where: { workerId: sam.id } })) === 0) {
    await prisma.credential.create({
      data: { workerId: sam.id, type: "RN License", number: "RN-4402", expiresAt: new Date("2027-06-30T00:00:00Z") },
    });
  }

  const jordan = await prisma.user.upsert({
    where: { email: "jordan@goldwatercare.com" },
    update: {},
    create: {
      email: "jordan@goldwatercare.com",
      name: "Jordan Lee",
      role: "WORKER",
      organizationId: org.id,
      facilityId: sunrise.id,
      position: "CNA",
      baseRate: 22,
      passwordHash,
    },
  });

  // Real facilities with their budgeted daily coverage (CNA & Nurse), plus this
  // week's schedule pre-built from that budget so they show as default schedules.
  const currentWeekStart = weekStartOf(new Date());
  for (const budget of DEFAULT_FACILITY_BUDGET) {
    const facility = await prisma.facility.upsert({
      where: { id: `seed-${facilitySlug(budget.facility)}` },
      update: { organizationId: org.id },
      create: { id: `seed-${facilitySlug(budget.facility)}`, name: budget.facility, organizationId: org.id },
    });
    for (const row of budgetToRows(budget)) {
      const existing = await prisma.templateShift.findFirst({
        where: { facilityId: facility.id, position: row.position, startTime: row.startTime, endTime: row.endTime },
      });
      if (existing) {
        if (existing.count !== row.count) {
          await prisma.templateShift.update({ where: { id: existing.id }, data: { count: row.count, active: true } });
        }
      } else {
        await prisma.templateShift.create({ data: { facilityId: facility.id, ...row } });
      }
    }

    // Build the current week's PLANNED shifts (once).
    const schedule = await prisma.schedule.upsert({
      where: { facilityId_weekStart: { facilityId: facility.id, weekStart: currentWeekStart } },
      update: {},
      create: { facilityId: facility.id, weekStart: currentWeekStart },
    });
    if ((await prisma.shift.count({ where: { scheduleId: schedule.id } })) === 0) {
      const shiftData = [];
      for (let day = 0; day < 7; day++) {
        for (const row of budgetToRows(budget)) {
          for (let i = 0; i < row.count; i++) {
            const startTime = combineDayTime(currentWeekStart, day, row.startTime);
            let endTime = combineDayTime(currentWeekStart, day, row.endTime);
            if (endTime.getTime() <= startTime.getTime()) endTime = new Date(endTime.getTime() + 86400000);
            shiftData.push({
              title: `${row.position} shift`, position: row.position, facilityId: facility.id,
              startTime, endTime, status: "PLANNED", scheduleId: schedule.id, postedById: corporate.id,
            });
          }
        }
      }
      await prisma.shift.createMany({ data: shiftData });
    }
  }

  // Staffing template (the weekly "budget" of coverage per facility).
  if ((await prisma.templateShift.count()) === 0) {
    await prisma.templateShift.createMany({
      data: [
        // Daily coverage — applies to every day of the week.
        { facilityId: sunrise.id, position: "CNA", startTime: "07:00", endTime: "15:00", count: 2 },
        { facilityId: sunrise.id, position: "Nurse", startTime: "19:00", endTime: "07:00", count: 1, bonus: 25 },
        { facilityId: main.id, position: "Nurse", startTime: "19:00", endTime: "07:00", count: 2, bonus: 50 },
      ],
    });
  }

  // A published week at Sunrise so staff have something to see: one CNA shift
  // pre-assigned to Jordan, plus open shifts in the marketplace.
  const weekStart = weekStartOf(new Date());
  if ((await prisma.schedule.count()) === 0) {
    const schedule = await prisma.schedule.create({
      data: { facilityId: sunrise.id, weekStart, published: true, publishedAt: new Date() },
    });
    const cnaDay = slot(weekStart, 2, "07:00", "15:00");
    const nurseNight = slot(weekStart, 2, "19:00", "07:00");
    await prisma.shift.create({
      data: {
        title: "CNA shift", position: "CNA", facilityId: sunrise.id, scheduleId: schedule.id,
        ...cnaDay, status: "ASSIGNED", assignedToId: jordan.id, postedById: corporate.id,
      },
    });
    await prisma.shift.create({
      data: {
        title: "CNA shift", position: "CNA", facilityId: sunrise.id, scheduleId: schedule.id,
        ...cnaDay, status: "OPEN", postedById: corporate.id,
      },
    });
    await prisma.shift.create({
      data: {
        title: "Nurse shift", position: "Nurse", facilityId: sunrise.id, scheduleId: schedule.id,
        ...nurseNight, status: "OPEN", bonus: 25, postedById: corporate.id,
      },
    });
  }

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log("Corporate (sees all):   corporate@goldwatercare.com");
  console.log("Sunrise scheduler:      sunrise.manager@goldwatercare.com");
  console.log("Main scheduler:         main.manager@goldwatercare.com");
  console.log("Staff (Sunrise):        jordan@goldwatercare.com");
  console.log("Staff (Main):           sam@goldwatercare.com");
  console.log(`Password (all):         ${DEMO_PASSWORD}`);
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
