import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { PoolShiftPostForm } from "@/components/PoolShiftPostForm";
import { formatHours } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export default async function AdminPoolShiftsPage() {
  const me = (await getCurrentUser())!;
  const now = new Date();

  const facilities = await prisma.facility.findMany({
    where: { active: true, ...orgWhere(me) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const shifts = await prisma.shift.findMany({
    where: {
      requiredLicense: { not: null },
      startTime: { gte: now },
      facility: orgWhere(me),
    },
    include: { facility: { select: { name: true } }, assignments: { where: { status: { notIn: ["CANCELLED"] } }, select: { id: true } } },
    orderBy: { startTime: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Post shifts for the Nurse Pool. Posting alerts every eligible, oriented nurse whose
        preferences match — they claim from their phone.
      </p>

      <PoolShiftPostForm facilities={facilities} />

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming pool shifts</h2>
        {shifts.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No upcoming pool shifts.</p>
        ) : (
          <div className="space-y-1">
            {shifts.map((s) => {
              const filled = s.assignments.length;
              const full = filled >= s.nursesNeeded;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                  <span>
                    <span className="font-semibold text-slate-800">{s.facility?.name}</span>
                    <span className="text-slate-500"> · {s.requiredLicense} · {fmt(s.startTime)}</span>
                  </span>
                  <span className={`chip ${full ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {filled}/{s.nursesNeeded} filled
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
