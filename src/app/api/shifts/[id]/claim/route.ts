import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { notifyFacilityManagers } from "@/lib/notify";
import { claimSchema } from "@/lib/validation";

// Worker claims a shift (creates a PENDING claim awaiting manager approval).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "WORKER") {
    return NextResponse.json({ error: "Only staff can claim shifts" }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = claimSchema.safeParse(json);
  const message = parsed.success ? parsed.data.message || null : null;

  const shift = await prisma.shift.findUnique({ where: { id: params.id } });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!canAccessFacility(user, shift.facilityId)) {
    return NextResponse.json({ error: "That shift is at a different facility" }, { status: 403 });
  }
  if (shift.status !== "OPEN") {
    return NextResponse.json({ error: "This shift is no longer open" }, { status: 409 });
  }

  const existing = await prisma.claim.findUnique({
    where: { shiftId_workerId: { shiftId: shift.id, workerId: user.id } },
  });
  if (existing && existing.status !== "WITHDRAWN" && existing.status !== "REJECTED") {
    return NextResponse.json({ error: "You've already claimed this shift" }, { status: 409 });
  }

  // Re-claiming after a withdrawal/rejection just resets the existing row.
  const claim = existing
    ? await prisma.claim.update({
        where: { id: existing.id },
        data: { status: "PENDING", message, decidedAt: null, createdAt: new Date() },
      })
    : await prisma.claim.create({
        data: { shiftId: shift.id, workerId: user.id, message },
      });

  await notifyFacilityManagers(shift.facilityId, {
    title: "New shift claim",
    body: `${user.name} claimed "${shift.title}". Approve or reassign it.`,
    link: `/manage`,
  });

  return NextResponse.json({ id: claim.id, status: claim.status });
}

// Worker withdraws their own claim.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const existing = await prisma.claim.findUnique({
    where: { shiftId_workerId: { shiftId: params.id, workerId: user.id } },
    include: { shift: true },
  });
  if (!existing) return NextResponse.json({ error: "No claim to withdraw" }, { status: 404 });

  await prisma.claim.update({
    where: { id: existing.id },
    data: { status: "WITHDRAWN", decidedAt: new Date() },
  });

  // If this worker had been approved, reopen the shift.
  if (existing.status === "APPROVED") {
    await prisma.shift.update({ where: { id: params.id }, data: { status: "OPEN" } });
    await notifyFacilityManagers(existing.shift.facilityId, {
      title: "Approved worker withdrew",
      body: `${user.name} withdrew from a shift they were assigned. It's open again.`,
      link: `/manage`,
    });
  }

  return NextResponse.json({ ok: true });
}
