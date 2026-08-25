import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// Cancel a shift (scheduler only). Notifies anyone with an active claim.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) {
    return NextResponse.json({ error: "Only schedulers can change shifts" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: {
      claims: { where: { status: { in: ["PENDING", "APPROVED"] } } },
      facility: { select: { organizationId: true } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!canAccessFacility(user, shift.facilityId) || !sameOrg(user, shift.facility?.organizationId)) {
    return NextResponse.json({ error: "That shift is at a different facility" }, { status: 403 });
  }

  if (action === "cancel") {
    await prisma.$transaction([
      prisma.shift.update({ where: { id: shift.id }, data: { status: "CANCELLED" } }),
      prisma.claim.updateMany({
        where: { shiftId: shift.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "REJECTED", decidedAt: new Date() },
      }),
    ]);
    await Promise.all(
      shift.claims.map((c) =>
        notify({
          userId: c.workerId,
          title: "Shift cancelled",
          body: `"${shift.title}" was cancelled by the scheduler.`,
          link: `/my-shifts`,
        })
      )
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    await prisma.shift.update({ where: { id: shift.id }, data: { status: "COMPLETED" } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// Permanently delete a shift (scheduler/corporate, own facility). Notifies anyone
// with an active claim; their claims are removed with the shift (cascade).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) {
    return NextResponse.json({ error: "Only schedulers can delete shifts" }, { status: 403 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: {
      claims: { where: { status: { in: ["PENDING", "APPROVED"] } } },
      facility: { select: { organizationId: true } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!canAccessFacility(user, shift.facilityId) || !sameOrg(user, shift.facility?.organizationId)) {
    return NextResponse.json({ error: "That shift is at a different facility" }, { status: 403 });
  }
  // Changing a scheduled day's shifts is admin-only; schedulers just fill them.
  if (shift.scheduleId && !isCorporate(user)) {
    return NextResponse.json({ error: "Only corporate can remove a scheduled shift" }, { status: 403 });
  }

  // Notify people who had claimed it, before it's gone.
  await Promise.all(
    shift.claims.map((c) =>
      notify({
        userId: c.workerId,
        title: "Shift removed",
        body: `"${shift.title}" was removed by the scheduler.`,
        link: `/shifts`,
      })
    )
  );

  await prisma.shift.delete({ where: { id: shift.id } });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "shift.delete", entityType: "Shift", entityId: shift.id,
    before: { title: shift.title, position: shift.position, status: shift.status },
  });
  return NextResponse.json({ ok: true });
}
