import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { generateWeekSchema } from "@/lib/validation";
import { parseWeekStart } from "@/lib/week";
import { buildWeekFromTemplate } from "@/lib/scheduleBuild";

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
  const fac = await prisma.facility.findUnique({ where: { id: facilityId }, select: { organizationId: true } });
  if (!fac || !sameOrg(user, fac.organizationId)) {
    return NextResponse.json({ error: "That facility is out of your scope" }, { status: 403 });
  }
  const weekStart = parseWeekStart(parsed.data.weekStart);

  const result = await buildWeekFromTemplate(facilityId, weekStart, user.id);
  if (result.noTemplate) {
    return NextResponse.json(
      { error: "No staffing template for this facility yet. Add one in Admin → Coverage." },
      { status: 400 }
    );
  }
  if (result.alreadyBuilt) {
    return NextResponse.json({ scheduleId: result.scheduleId, created: 0, message: "Week already built" });
  }

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "schedule.generate", entityType: "Schedule", entityId: result.scheduleId,
    after: { facilityId, created: result.created },
  });
  return NextResponse.json({ scheduleId: result.scheduleId, created: result.created });
}
