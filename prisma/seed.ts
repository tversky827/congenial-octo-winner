import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { weekStartOf, combineDayTime } from "../src/lib/week";

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

  // Facilities (each has its own shift board).
  const sunrise = await prisma.facility.upsert({
    where: { id: "seed-sunrise" },
    update: {},
    create: { id: "seed-sunrise", name: "Sunrise House", address: "120 Elm St" },
  });
  const main = await prisma.facility.upsert({
    where: { id: "seed-main" },
    update: {},
    create: { id: "seed-main", name: "Goldwater Main", address: "500 Center Ave" },
  });

  // Corporate oversight account (sees all facilities).
  const corporate = await prisma.user.upsert({
    where: { email: "corporate@goldwatercare.com" },
    update: {},
    create: {
      email: "corporate@goldwatercare.com",
      name: "Corporate Admin",
      role: "CORPORATE",
      passwordHash,
    },
  });

  // A facility scheduler for each site.
  await prisma.user.upsert({
    where: { email: "sunrise.manager@goldwatercare.com" },
    update: {},
    create: {
      email: "sunrise.manager@goldwatercare.com",
      name: "Morgan (Sunrise)",
      role: "MANAGER",
      facilityId: sunrise.id,
      position: "Scheduler",
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "main.manager@goldwatercare.com" },
    update: {},
    create: {
      email: "main.manager@goldwatercare.com",
      name: "Alex (Main)",
      role: "MANAGER",
      facilityId: main.id,
      position: "Scheduler",
      passwordHash,
    },
  });

  // Staff, each tied to one facility.
  const jordan = await prisma.user.upsert({
    where: { email: "jordan@goldwatercare.com" },
    update: {},
    create: {
      email: "jordan@goldwatercare.com",
      name: "Jordan Lee",
      role: "WORKER",
      facilityId: sunrise.id,
      position: "CNA",
      baseRate: 22,
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "sam@goldwatercare.com" },
    update: {},
    create: {
      email: "sam@goldwatercare.com",
      name: "Sam Rivera",
      role: "WORKER",
      facilityId: main.id,
      position: "Nurse",
      baseRate: 40,
      passwordHash,
    },
  });

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
