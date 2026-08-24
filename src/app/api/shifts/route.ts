import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { createShiftSchema } from "@/lib/validation";

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

  const shift = await prisma.shift.create({
    data: {
      title: d.title,
      position: d.position,
      facilityId,
      location: d.location || null,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      differential: d.differential,
      breakMinutes: d.breakMinutes,
      overtimeAfterHours: d.overtimeAfterHours,
      overtimeMultiplier: d.overtimeMultiplier,
      notes: d.notes || null,
      postedById: user.id,
    },
  });

  return NextResponse.json({ id: shift.id });
}
