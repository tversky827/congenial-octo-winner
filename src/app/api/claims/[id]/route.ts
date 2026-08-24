import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { notify } from "@/lib/notify";
import { decideClaimSchema } from "@/lib/validation";

// Manager approves or rejects a specific claim.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) {
    return NextResponse.json({ error: "Only schedulers can decide claims" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = decideClaimSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({
    where: { id: params.id },
    include: { shift: true, worker: true },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (!canAccessFacility(user, claim.shift.facilityId)) {
    return NextResponse.json({ error: "That shift is at a different facility" }, { status: 403 });
  }

  if (parsed.data.decision === "REJECTED") {
    await prisma.claim.update({
      where: { id: claim.id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    await notify({
      userId: claim.workerId,
      title: "Shift claim declined",
      body: `Your claim on "${claim.shift.title}" was not approved this time.`,
      link: `/my-shifts`,
    });
    return NextResponse.json({ ok: true });
  }

  // APPROVED: assign this worker, fill the shift, reject other pending claims.
  if (claim.shift.status !== "OPEN") {
    return NextResponse.json({ error: "This shift is no longer open" }, { status: 409 });
  }

  const otherClaims = await prisma.claim.findMany({
    where: { shiftId: claim.shiftId, status: "PENDING", id: { not: claim.id } },
    select: { id: true, workerId: true },
  });

  await prisma.$transaction([
    prisma.claim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", decidedAt: new Date() },
    }),
    prisma.claim.updateMany({
      where: { id: { in: otherClaims.map((c) => c.id) } },
      data: { status: "REJECTED", decidedAt: new Date() },
    }),
    prisma.shift.update({ where: { id: claim.shiftId }, data: { status: "FILLED" } }),
  ]);

  await notify({
    userId: claim.workerId,
    title: "You got the shift! 🎉",
    body: `You're confirmed for "${claim.shift.title}".`,
    link: `/my-shifts`,
  });
  await Promise.all(
    otherClaims.map((c) =>
      notify({
        userId: c.workerId,
        title: "Shift filled",
        body: `"${claim.shift.title}" was assigned to another team member.`,
        link: `/my-shifts`,
      })
    )
  );

  return NextResponse.json({ ok: true });
}
