import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { ensureOrganizationForUser } from "@/lib/org";
import { audit } from "@/lib/audit";
import { payrollPeriodSchema } from "@/lib/validation";

// Create a payroll period (corporate). Dates are UTC day boundaries.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = payrollPeriodSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const startDate = new Date(`${parsed.data.startDate}T00:00:00Z`);
  const endDate = new Date(`${parsed.data.endDate}T00:00:00Z`);
  if (endDate <= startDate) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const organizationId = await ensureOrganizationForUser(user);
  const existing = await prisma.payrollPeriod.findUnique({
    where: { organizationId_startDate_endDate: { organizationId, startDate, endDate } },
  });
  if (existing) return NextResponse.json({ id: existing.id, existed: true });

  const period = await prisma.payrollPeriod.create({ data: { organizationId, startDate, endDate } });
  await audit({
    actorId: user.id, actorName: user.name, organizationId,
    action: "payroll.period_create", entityType: "PayrollPeriod", entityId: period.id,
    after: { startDate: parsed.data.startDate, endDate: parsed.data.endDate },
  });
  return NextResponse.json({ id: period.id });
}
