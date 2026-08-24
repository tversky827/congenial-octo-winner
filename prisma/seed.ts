import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo password for every seeded account. Change these after first login.
const DEMO_PASSWORD = "password123";

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
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
  await prisma.user.upsert({
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

  const existingShifts = await prisma.shift.count();
  if (existingShifts === 0) {
    await prisma.shift.createMany({
      data: [
        {
          title: "CNA shift",
          position: "CNA",
          facilityId: sunrise.id,
          startTime: at(1, 7),
          endTime: at(1, 15),
          notes: "Familiarity with dementia care preferred.",
          postedById: corporate.id,
        },
        {
          title: "Nurse shift",
          position: "Nurse",
          facilityId: sunrise.id,
          startTime: at(3, 15),
          endTime: at(3, 21),
          bonus: 25,
          postedById: corporate.id,
        },
        {
          title: "Nurse shift",
          position: "Nurse",
          facilityId: main.id,
          startTime: at(1, 19),
          endTime: at(2, 7),
          bonus: 75,
          notes: "Overnight — pick-up bonus included.",
          postedById: corporate.id,
        },
      ],
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
