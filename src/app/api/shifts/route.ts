import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { createShiftSchema } from "@/lib/validation";
import { isAllowedPosition } from "@/lib/positionsServer";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) {
    return NextResponse.json({ error: "Only schedulers can post shifts" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createShiftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Corporate posts to any facility (must choose one); a facility manager always
  // posts to their own facility.
  let facilityId: string | null;
  if (isCorporate(user)) {
    if (!d.facilityId) {
      return NextResponse.json({ error: "Please choose a facility for this shift" }, { status: 400 });
    }
    const facility = await prisma.facility.findFirst({ where: { id: d.facilityId, active: true } });
    if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 400 });
    facilityId = facility.id;
  } else {
    facilityId = user.facilityId;
    if (!facilityId) {
      return NextResponse.json(
        { error: "Your account isn't assigned to a facility yet — ask corporate to set it." },
        { status: 400 }
      );
    }
  }

  if (!(await isAllowedPosition(user.organizationId, d.position))) {
    return NextResponse.json({ error: "That role isn't configured for your organization" }, { status: 400 });
  }

  const shift = await prisma.shift.create({
    data: {
      // No custom title anymore — derive a simple label from the role.
      title: `${d.position} shift`,
      position: d.position,
      facilityId,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      bonus: d.bonus,
      notes: d.notes || null,
      postedById: user.id,
    },
  });

  return NextResponse.json({ id: shift.id });
}
