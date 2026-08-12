import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isManager } from "@/lib/auth";
import { notify } from "@/lib/notify";

// Cancel a shift (manager only). Notifies anyone with an active claim.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isManager(user)) {
    return NextResponse.json({ error: "Only managers can change shifts" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { claims: { where: { status: { in: ["PENDING", "APPROVED"] } } } },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

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
