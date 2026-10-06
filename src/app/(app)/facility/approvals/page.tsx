import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApproveHoursRow } from "@/components/ApproveHoursRow";
import { formatHours } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export default async function FacilityApprovalsPage() {
  const me = (await getCurrentUser())!;
  const facilityId = me.facilityId;
  if (!facilityId) return null;

  const now = new Date();
  const pending = await prisma.shiftAssignment.findMany({
    where: { facilityId, approvalStatus: { not: "APPROVED" }, status: { notIn: ["CANCELLED"] }, scheduledEnd: { lt: now } },
    include: { nurse: { select: { name: true } } },
    orderBy: { scheduledStart: "asc" },
    take: 200,
  });

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Approve the hours each pool nurse worked at your facility. Approved hours drive payroll and
        your facility&apos;s cost.
      </p>
      {pending.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Nothing waiting. 🎉</p>
      ) : (
        <div className="space-y-2">
          {pending.map((a) => (
            <div key={a.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{a.nurse.name}</p>
                  <p className="text-xs text-slate-500">{fmt(a.scheduledStart)}</p>
                </div>
                <span className="text-sm text-slate-500">{formatHours(a.scheduledHours)} sched</span>
              </div>
              <ApproveHoursRow assignmentId={a.id} scheduledHours={a.scheduledHours} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
