import { getCurrentUser, canManage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { facilityScopeWhere } from "@/lib/access";
import { ShiftCard, type ShiftCardData } from "@/components/ShiftCard";
import { PageHeader, EmptyState } from "@/components/Page";
import { FacilityFilter } from "@/components/FacilityFilter";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ShiftWithFacility = {
  id: string;
  title: string;
  position: string;
  location: string | null;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  hourlyRate: number;
  differential: number;
  overtimeAfterHours: number;
  overtimeMultiplier: number;
  notes: string | null;
  status: string;
  facility: { name: string } | null;
};

function toCardData(shift: ShiftWithFacility): ShiftCardData {
  return {
    id: shift.id,
    title: shift.title,
    position: shift.position,
    facilityName: shift.facility?.name ?? null,
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

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: { facility?: string };
}) {
  const user = (await getCurrentUser())!;
  const isStaff = user.role === "WORKER";
  const selectedFacility = user.role === "CORPORATE" ? searchParams.facility || null : null;

  const postButton = canManage(user) ? (
    <Link href="/shifts/new" className="btn-primary text-sm">+ Post shift</Link>
  ) : null;
  const headerAction = (
    <div className="flex items-center gap-2">
      <Link href="/calendar" className="btn-secondary text-sm">📅 Calendar</Link>
      {postButton}
    </div>
  );

  // Corporate gets a facility switcher.
  let facilityFilter: React.ReactNode = null;
  if (user.role === "CORPORATE") {
    const facilities = await prisma.facility.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    facilityFilter = <FacilityFilter facilities={facilities} />;
  }

  if (!isStaff) {
    // CORPORATE / MANAGER: shifts that still need filling.
    const shifts = await prisma.shift.findMany({
      where: {
        status: { in: ["OPEN", "FILLED"] },
        ...facilityScopeWhere(user, selectedFacility),
      },
      orderBy: { startTime: "asc" },
      include: {
        facility: { select: { name: true } },
        _count: { select: { claims: { where: { status: "PENDING" } } } },
      },
    });

    return (
      <div>
        <PageHeader
          title="Open shifts"
          subtitle={
            user.role === "CORPORATE"
              ? "Shifts across all facilities that still need filling."
              : "Shifts at your facility that still need filling."
          }
          action={headerAction}
        />
        {facilityFilter && <div className="mb-4">{facilityFilter}</div>}
        {shifts.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="No open shifts"
            body="Post a shift and your team can start claiming it."
            cta={<Link href="/shifts/new" className="btn-primary">Post a shift</Link>}
          />
        ) : (
          <div className="space-y-3">
            {shifts.map((s) => (
              <ShiftCard
                key={s.id}
                shift={toCardData(s)}
                viewerRole={user.role as "CORPORATE" | "MANAGER"}
                claimCount={s._count.claims}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // WORKER view — only their facility's open shifts.
  const [openShifts, myClaims] = await Promise.all([
    prisma.shift.findMany({
      where: { status: "OPEN", ...facilityScopeWhere(user) },
      orderBy: { startTime: "asc" },
      include: { facility: { select: { name: true } } },
    }),
    prisma.claim.findMany({ where: { workerId: user.id } }),
  ]);
  const claimByShift = new Map(myClaims.map((c) => [c.shiftId, c.status]));

  return (
    <div>
      <PageHeader
        title="Available shifts"
        subtitle={user.position ? `Open shifts · You're a ${user.position}` : "Open shifts at your facility"}
        action={headerAction}
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
              viewerRate={user.baseRate}
              myClaimStatus={claimByShift.get(s.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
