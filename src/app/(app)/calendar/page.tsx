import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { facilityScopeWhere } from "@/lib/access";
import { Calendar, type CalendarShift } from "@/components/Calendar";
import { FacilityFilter } from "@/components/FacilityFilter";
import { PageHeader } from "@/components/Page";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { facility?: string };
}) {
  const user = (await getCurrentUser())!;
  const selectedFacility = user.role === "CORPORATE" ? searchParams.facility || null : null;

  // Window: last month through ~3 months ahead, so month navigation has data.
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);

  const shifts = await prisma.shift.findMany({
    where: {
      status: { not: "CANCELLED" },
      startTime: { gte: windowStart, lte: windowEnd },
      ...facilityScopeWhere(user, selectedFacility),
    },
    orderBy: { startTime: "asc" },
    include: { facility: { select: { name: true } } },
  });

  const calShifts: CalendarShift[] = shifts.map((s) => ({
    id: s.id,
    title: s.title,
    position: s.position,
    facilityName: s.facility?.name ?? null,
    startISO: s.startTime.toISOString(),
    endISO: s.endTime.toISOString(),
    status: s.status,
    differential: s.differential,
    breakMinutes: s.breakMinutes,
    overtimeAfterHours: s.overtimeAfterHours,
    overtimeMultiplier: s.overtimeMultiplier,
  }));

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={user.role === "CORPORATE" ? "Shifts across your facilities." : "Shifts at your facility."}
        action={<Link href="/shifts" className="btn-secondary text-sm">List view</Link>}
      />
      {user.role === "CORPORATE" && (
        <div className="mb-4">
          <FacilityFilter facilities={await prisma.facility.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })} />
        </div>
      )}
      <Calendar
        shifts={calShifts}
        viewerRate={user.role === "WORKER" ? user.baseRate : null}
        showFacility={user.role === "CORPORATE"}
      />
    </div>
  );
}
