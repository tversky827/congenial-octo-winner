import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManage } from "@/lib/auth";
import { canAccessFacility } from "@/lib/access";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
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
    include: { shift: { include: { facility: { select: { organizationId: true } } } }, worker: true },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (!canAccessFacility(user, claim.shift.facilityId) || !sameOrg(user, claim.shift.facility?.organizationId)) {
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

  // APPROVED: fill the shift atomically so two concurrent approvals can't both
  // win. The conditional update on status="OPEN" is the single source of truth —
  // exactly one caller flips it and gets the shift.
  const filled = await prisma.shift.updateMany({
    where: { id: claim.shiftId, status: "OPEN" },
    data: { status: "FILLED", assignedToId: claim.workerId },
  });
  if (filled.count === 0) {
    return NextResponse.json({ error: "This shift has already been filled." }, { status: 409 });
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
  ]);

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "pickup.approve", entityType: "Shift", entityId: claim.shiftId,
    after: { worker: claim.worker.name, claimId: claim.id },
  });

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
