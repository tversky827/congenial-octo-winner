import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { workedMinutes, actualPay } from "@/lib/timeclock";

// Clock in / clock out for a shift you're assigned to.
//   POST { action: "in" }  → opens a TimeEntry (once)
//   POST { action: "out" } → closes it and computes actual minutes + pay
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "in" && action !== "out") {
    return NextResponse.json({ error: "Specify action: 'in' or 'out'" }, { status: 400 });
  }

  const shift = await prisma.shift.findUnique({ where: { id: params.id } });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (shift.assignedToId !== user.id) {
    return NextResponse.json({ error: "You're not assigned to this shift." }, { status: 403 });
  }

  const existing = await prisma.timeEntry.findUnique({
    where: { shiftId_workerId: { shiftId: shift.id, workerId: user.id } },
  });

  if (action === "in") {
    if (existing) {
      return NextResponse.json({ error: "You've already clocked in for this shift." }, { status: 409 });
    }
    const entry = await prisma.timeEntry.create({
      data: { shiftId: shift.id, workerId: user.id, facilityId: shift.facilityId },
    });
    await audit({
      actorId: user.id, actorName: user.name, organizationId: user.organizationId,
      action: "timeclock.in", entityType: "Shift", entityId: shift.id,
    });
    return NextResponse.json({ ok: true, clockInAt: entry.clockInAt });
  }

  // action === "out"
  if (!existing) {
    return NextResponse.json({ error: "Clock in first." }, { status: 409 });
  }
  if (existing.clockOutAt) {
    return NextResponse.json({ error: "You've already clocked out." }, { status: 409 });
  }

  const clockOutAt = new Date();
  const minutes = workedMinutes(existing.clockInAt, clockOutAt);
  const pay = actualPay(minutes, user.baseRate, shift.bonus);

  const entry = await prisma.timeEntry.update({
    where: { id: existing.id },
    data: { clockOutAt, actualMinutes: minutes, actualPay: pay },
  });
  // Mark the shift done once the assigned worker has clocked out.
  if (shift.status === "ASSIGNED" || shift.status === "FILLED") {
    await prisma.shift.update({ where: { id: shift.id }, data: { status: "COMPLETED" } });
  }

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "timeclock.out", entityType: "Shift", entityId: shift.id,
    after: { minutes, pay },
  });

  return NextResponse.json({ ok: true, actualMinutes: minutes, actualPay: pay, clockOutAt: entry.clockOutAt });
}
