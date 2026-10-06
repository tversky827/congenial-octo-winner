import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { approveHoursSchema } from "@/lib/validation";
import { approveAssignmentHours } from "@/lib/poolApproval";

// Facility approves the payable hours for a pool assignment.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "timecard.approve")) {
    return NextResponse.json({ error: "Not allowed to approve hours" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = approveHoursSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: params.id },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  if (!canAccessFacility(user, assignment.facilityId) || !sameOrg(user, assignment.facility?.organizationId)) {
    return NextResponse.json({ error: "That assignment is at a different facility" }, { status: 403 });
  }

  await approveAssignmentHours(
    params.id,
    { id: user.id, name: user.name, organizationId: user.organizationId },
    parsed.data.approvedHours
  );
  return NextResponse.json({ ok: true });
}
