import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { assignShiftSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";

// Scheduler places (or removes) one of our employees on a shift.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Schedulers only" }, { status: 403 });

  const json = await req.json().catch(() => ({}));
  const parsed = assignShiftSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { schedule: true },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!canAccessFacility(user, shift.facilityId)) {
    return NextResponse.json({ error: "Out of your scope" }, { status: 403 });
  }

  const published = shift.schedule?.published ?? false;
  const workerId = parsed.data.workerId || null;

  // Unassign → back to planned (draft) or open (published marketplace).
  if (!workerId) {
    await prisma.shift.update({
      where: { id: shift.id },
      data: { assignedToId: null, status: published ? "OPEN" : "PLANNED" },
    });
    return NextResponse.json({ ok: true, status: published ? "OPEN" : "PLANNED" });
  }

  // Assign: the employee must be active staff at this facility with the right role.
  const worker = await prisma.user.findUnique({ where: { id: workerId } });
  if (!worker || worker.role !== "WORKER" || !worker.active) {
    return NextResponse.json({ error: "Not an active staff member" }, { status: 400 });
  }
  if (worker.facilityId !== shift.facilityId) {
    return NextResponse.json({ error: "That employee is at a different facility" }, { status: 400 });
  }
  if (worker.position !== shift.position) {
    return NextResponse.json({ error: `That shift needs a ${shift.position}` }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: shift.id },
      data: { assignedToId: worker.id, status: "ASSIGNED" },
    }),
    // Assigning directly supersedes any marketplace claims on this shift.
    prisma.claim.updateMany({
      where: { shiftId: shift.id, status: "PENDING" },
      data: { status: "REJECTED", decidedAt: new Date() },
    }),
  ]);

  // If the week is already live, let the employee know right away.
  if (published) {
    await notify({
      userId: worker.id,
      title: "You've been scheduled",
      body: `You're on a ${shift.title}. See My Shifts.`,
      link: "/my-shifts",
    });
  }

  return NextResponse.json({ ok: true, status: "ASSIGNED" });
}
