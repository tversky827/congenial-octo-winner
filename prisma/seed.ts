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

  const manager = await prisma.user.upsert({
    where: { email: "manager@goldwatercare.com" },
    update: {},
    create: {
      email: "manager@goldwatercare.com",
      name: "Alex (Manager)",
      role: "MANAGER",
      position: "Scheduler",
      passwordHash,
    },
  });

  const workers = await Promise.all(
    [
      { email: "jordan@goldwatercare.com", name: "Jordan Lee", position: "CNA", baseRate: 22 },
      { email: "sam@goldwatercare.com", name: "Sam Rivera", position: "RN", baseRate: 40 },
      { email: "casey@goldwatercare.com", name: "Casey Nguyen", position: "Caregiver", baseRate: 18 },
    ].map((w) =>
      prisma.user.upsert({
        where: { email: w.email },
        update: {},
        create: { ...w, role: "WORKER", passwordHash },
      })
    )
  );

  // Only seed sample shifts if none exist yet, so re-running seed doesn't pile them up.
  const existingShifts = await prisma.shift.count();
  if (existingShifts === 0) {
    await prisma.shift.createMany({
      data: [
        {
          title: "Day shift — Memory Care",
          position: "CNA",
          location: "Sunrise House, 2nd Floor",
          startTime: at(1, 7),
          endTime: at(1, 15),
          hourlyRate: 24,
          differential: 0,
          breakMinutes: 30,
          notes: "Familiarity with dementia care preferred.",
          postedById: manager.id,
        },
        {
          title: "Night shift — Skilled Nursing",
          position: "RN",
          location: "Goldwater Main, Unit B",
          startTime: at(1, 19),
          endTime: at(2, 7),
          hourlyRate: 42,
          differential: 6,
          breakMinutes: 30,
          notes: "Night differential included. 12-hour shift.",
          postedById: manager.id,
        },
        {
          title: "Weekend companion care",
          position: "Caregiver",
          location: "Client home — Elm St",
          startTime: at(3, 9),
          endTime: at(3, 14),
          hourlyRate: 20,
          differential: 2,
          breakMinutes: 0,
          notes: "Light housekeeping and meal prep.",
          postedById: manager.id,
        },
      ],
    });
  }

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log("Manager login:  manager@goldwatercare.com");
  console.log(`Worker logins:  ${workers.map((w) => w.email).join(", ")}`);
  console.log(`Password (all): ${DEMO_PASSWORD}`);
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
