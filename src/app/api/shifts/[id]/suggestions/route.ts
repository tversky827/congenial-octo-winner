import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { suggestCandidatesForShift } from "@/lib/matchingData";

// Ranked fill suggestions for a shift (scheduler/corporate).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) {
    return NextResponse.json({ error: "Only schedulers can view suggestions" }, { status: 403 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!canAccessFacility(user, shift.facilityId) || !sameOrg(user, shift.facility?.organizationId)) {
    return NextResponse.json({ error: "That shift is at a different facility" }, { status: 403 });
  }

  const suggestions = await suggestCandidatesForShift(shift.id);
  // Top few is all a scheduler needs.
  return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
}
