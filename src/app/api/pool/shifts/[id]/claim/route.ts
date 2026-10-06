import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { claimPoolShift, ClaimError } from "@/lib/poolClaim";

// A pool nurse claims one seat of a shift. All eligibility + race-safety is
// enforced server-side in claimPoolShift.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.poolMember) {
    return NextResponse.json({ error: "Only pool nurses can claim pool shifts." }, { status: 403 });
  }
  try {
    const assignment = await claimPoolShift(user.id, params.id);
    return NextResponse.json({ ok: true, assignmentId: assignment.id });
  } catch (e) {
    if (e instanceof ClaimError) {
      const conflict = e.reason === "SHIFT_FULL" || e.reason === "OVERLAP" || e.reason === "ALREADY_CLAIMED" || e.reason === "NOT_OPEN";
      return NextResponse.json({ error: e.message, reason: e.reason }, { status: conflict ? 409 : 403 });
    }
    return NextResponse.json({ error: "Could not claim the shift" }, { status: 500 });
  }
}
