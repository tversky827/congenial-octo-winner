import { redirect } from "next/navigation";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import {
  parseWeekStart,
  weekKey,
  addDays,
  weekDays,
  formatWeekRange,
  DAY_LABELS_LONG,
} from "@/lib/week";
import { PageHeader, EmptyState } from "@/components/Page";
import { SchedulerWeek, type SchedDay } from "@/components/SchedulerWeek";

export const dynamic = "force-dynamic";

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function timeLabel(start: Date, end: Date): string {
  const o: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: "UTC" };
  return `${start.toLocaleTimeString("en-US", o)} – ${end.toLocaleTimeString("en-US", o)}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { week?: string; facility?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManage(user)) redirect("/shifts");

  const corporate = isCorporate(user);
  const facilities = corporate
    ? await prisma.facility.findMany({ where: { active: true, ...orgWhere(user) }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const facilityId = corporate ? searchParams.facility || facilities[0]?.id || "" : user.facilityId || "";

  if (!facilityId) {
    return (
      <div>
        <PageHeader title="Schedule" />
        <EmptyState
          emoji="🏢"
          title={corporate ? "Add a facility first" : "No facility assigned"}
          body={corporate ? "Create a facility and set its coverage in Admin, then build a schedule." : "Ask corporate to assign your facility."}
        />
      </div>
    );
  }

  const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { name: true } });
  const weekStart = parseWeekStart(searchParams.week);

  const schedule = await prisma.schedule.findUnique({
    where: { facilityId_weekStart: { facilityId, weekStart } },
    include: { shifts: { orderBy: { startTime: "asc" } } },
  });
  const built = !!schedule && schedule.shifts.length > 0;
  const shifts = schedule?.shifts ?? [];

  const days: SchedDay[] = weekDays(weekStart).map((day, i) => {
    const key = utcDayKey(day);
    return {
      label: DAY_LABELS_LONG[i],
      dayOffset: i,
      dateLabel: day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      shifts: shifts
        .filter((s) => utcDayKey(s.startTime) === key)
        .map((s) => ({
          id: s.id,
          position: s.position,
          timeLabel: timeLabel(s.startTime, s.endTime),
          bonus: s.bonus,
          status: s.status,
          assignedToId: s.assignedToId,
        })),
    };
  });

  const staff = await prisma.user.findMany({
    where: { facilityId, role: "WORKER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, position: true },
  });

  const assigned = shifts.filter((s) => s.assignedToId).length;
  const open = shifts.filter((s) => s.status === "OPEN").length;
  const counts = {
    total: shifts.length,
    assigned,
    unfilled: shifts.length - assigned,
    open,
  };

  return (
    <div>
      <PageHeader title="Schedule" subtitle={facility?.name ?? undefined} />
      <SchedulerWeek
        facilityId={facilityId}
        facilityName={facility?.name ?? "this facility"}
        isCorporate={corporate}
        facilities={facilities}
        weekKey={weekKey(weekStart)}
        weekLabel={formatWeekRange(weekStart)}
        prevKey={weekKey(addDays(weekStart, -7))}
        nextKey={weekKey(addDays(weekStart, 7))}
        scheduleId={schedule?.id ?? null}
        published={schedule?.published ?? false}
        built={built}
        days={days}
        staff={staff.map((s) => ({ id: s.id, name: s.name, position: s.position ?? "" }))}
        counts={counts}
      />
    </div>
  );
}
