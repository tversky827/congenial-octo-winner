import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DEFAULT_FACILITY_BUDGET, budgetToRows } from "@/lib/defaultCoverage";
import { buildWeekFromTemplate } from "@/lib/scheduleBuild";
import { weekStartOf } from "@/lib/week";

// One-click load of the budgeted daily coverage for every facility. Idempotent:
// creates any missing facility, then ensures each budgeted shift exists with the
// right count (updating an existing matching window rather than duplicating).
// Corporate only.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: "Set up your organization first." }, { status: 400 });
  }
  const organizationId = user.organizationId;

  let facilitiesCreated = 0;
  let shiftsCreated = 0;
  let shiftsUpdated = 0;
  let schedulesBuilt = 0;
  let scheduledShifts = 0;

  const weekStart = weekStartOf(new Date());

  for (const budget of DEFAULT_FACILITY_BUDGET) {
    let facility = await prisma.facility.findFirst({
      where: { organizationId, name: budget.facility },
    });
    if (!facility) {
      facility = await prisma.facility.create({
        data: { name: budget.facility, organizationId },
      });
      facilitiesCreated++;
    }

    for (const row of budgetToRows(budget)) {
      const existing = await prisma.templateShift.findFirst({
        where: {
          facilityId: facility.id,
          position: row.position,
          startTime: row.startTime,
          endTime: row.endTime,
        },
      });
      if (existing) {
        if (existing.count !== row.count || !existing.active) {
          await prisma.templateShift.update({
            where: { id: existing.id },
            data: { count: row.count, active: true },
          });
          shiftsUpdated++;
        }
      } else {
        await prisma.templateShift.create({
          data: {
            facilityId: facility.id,
            position: row.position,
            startTime: row.startTime,
            endTime: row.endTime,
            count: row.count,
          },
        });
        shiftsCreated++;
      }
    }

    // Build this week's schedule from the template so a populated "default"
    // schedule is visible immediately. Idempotent — skips a week already built.
    const build = await buildWeekFromTemplate(facility.id, weekStart, user.id);
    if (build.created > 0) {
      schedulesBuilt++;
      scheduledShifts += build.created;
    }
  }

  await audit({
    actorId: user.id, actorName: user.name, organizationId,
    action: "coverage.import_defaults", entityType: "Organization", entityId: organizationId,
    after: { facilitiesCreated, shiftsCreated, shiftsUpdated, schedulesBuilt, scheduledShifts },
  });

  return NextResponse.json({
    ok: true,
    facilities: DEFAULT_FACILITY_BUDGET.length,
    facilitiesCreated,
    shiftsCreated,
    shiftsUpdated,
    schedulesBuilt,
    scheduledShifts,
  });
}
