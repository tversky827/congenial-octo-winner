import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ShiftCard, type ShiftCardData } from "@/components/ShiftCard";
import { PageHeader, EmptyState } from "@/components/Page";
import Link from "next/link";
import type { Shift } from "@prisma/client";

export const dynamic = "force-dynamic";

function toCardData(shift: Shift): ShiftCardData {
  return {
    id: shift.id,
    title: shift.title,
    position: shift.position,
    location: shift.location,
    startTime: shift.startTime.toISOString(),
    endTime: shift.endTime.toISOString(),
    breakMinutes: shift.breakMinutes,
    hourlyRate: shift.hourlyRate,
    differential: shift.differential,
    overtimeAfterHours: shift.overtimeAfterHours,
    overtimeMultiplier: shift.overtimeMultiplier,
    notes: shift.notes,
    status: shift.status,
  };
}

export default async function ShiftsPage() {
  const user = (await getCurrentUser())!;

  if (user.role === "MANAGER") {
    const shifts = await prisma.shift.findMany({
      where: { status: { in: ["OPEN", "FILLED"] } },
      orderBy: { startTime: "asc" },
      include: { _count: { select: { claims: { where: { status: "PENDING" } } } } },
    });

    return (
      <div>
        <PageHeader
          title="Open shifts"
          subtitle="Shifts you've posted that still need to be filled."
          action={<Link href="/shifts/new" className="btn-primary text-sm">+ Post shift</Link>}
        />
        {shifts.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="No open shifts"
            body="Post your first shift and your team can start claiming it."
            cta={<Link href="/shifts/new" className="btn-primary">Post a shift</Link>}
          />
        ) : (
          <div className="space-y-3">
            {shifts.map((s) => (
              <ShiftCard
                key={s.id}
                shift={toCardData(s)}
                viewerRole="MANAGER"
                claimCount={s._count.claims}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // WORKER view
  const [openShifts, myClaims] = await Promise.all([
    prisma.shift.findMany({ where: { status: "OPEN" }, orderBy: { startTime: "asc" } }),
    prisma.claim.findMany({ where: { workerId: user.id } }),
  ]);
  const claimByShift = new Map(myClaims.map((c) => [c.shiftId, c.status]));

  return (
    <div>
      <PageHeader
        title="Available shifts"
        subtitle={user.position ? `Showing all open shifts · You're a ${user.position}` : "All open shifts"}
      />
      {openShifts.length === 0 ? (
        <EmptyState emoji="🌤️" title="No open shifts right now" body="Check back soon — new shifts appear here as they're posted." />
      ) : (
        <div className="space-y-3">
          {openShifts.map((s) => (
            <ShiftCard
              key={s.id}
              shift={toCardData(s)}
              viewerRole="WORKER"
              myClaimStatus={claimByShift.get(s.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
