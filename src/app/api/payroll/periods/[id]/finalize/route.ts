import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { finalizePayrollPeriod } from "@/lib/payrollFinalize";

export const maxDuration = 60;

// Finalize a payroll period → payroll records + labor cost allocations.
// Reconciliation hard-blocks unless { override: true } is passed by an
// authorized corporate user (recorded in the audit log).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const period = await prisma.payrollPeriod.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (!sameOrg(user, period.organizationId)) {
    return NextResponse.json({ error: "That period is in a different organization" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const allowOverride = body?.override === true;

  const result = await finalizePayrollPeriod(
    params.id,
    { id: user.id, name: user.name, organizationId: user.organizationId },
    { allowOverride }
  );
  // 409 when reconciliation blocked finalize (not an authorized override).
  const status = result.ok ? 200 : result.reconciliation && !result.reconciliation.balanced ? 409 : 400;
  return NextResponse.json(result, { status });
}
