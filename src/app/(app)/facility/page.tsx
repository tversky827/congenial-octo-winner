import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export default async function FacilityDashboardPage() {
  const me = (await getCurrentUser())!;
  const facilityId = me.facilityId;
  if (!facilityId) return null; // layout handles the no-facility case

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [openShifts, pendingApprovals, upcoming, allocations] = await Promise.all([
    prisma.shift.count({ where: { facilityId, requiredLicense: { not: null }, status: { in: ["OPEN", "PARTIALLY_FILLED"] }, startTime: { gte: now } } }),
    prisma.shiftAssignment.count({ where: { facilityId, approvalStatus: { not: "APPROVED" }, status: { notIn: ["CANCELLED"] }, scheduledEnd: { lt: now } } }),
    prisma.shiftAssignment.findMany({
      where: { facilityId, status: { notIn: ["CANCELLED"] }, scheduledStart: { gte: now } },
      include: { nurse: { select: { name: true, licenseType: true } } },
      orderBy: { scheduledStart: "asc" },
      take: 8,
    }),
    prisma.laborCostAllocation.findMany({
      where: { facilityId, assignment: { scheduledStart: { gte: since } } },
      select: { totalAllocated: true, regularHours: true, overtimeHours: true },
    }),
  ]);

  const laborCost = allocations.reduce((s, a) => s + a.totalAllocated, 0);
  const otHours = allocations.reduce((s, a) => s + a.overtimeHours, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/facility/post" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-2xl font-bold text-slate-900">{openShifts}</p>
          <p className="text-xs text-slate-500">Open pool shifts</p>
        </Link>
        <Link href="/facility/approvals" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-2xl font-bold text-slate-900">{pendingApprovals}</p>
          <p className="text-xs text-slate-500">Hours to approve</p>
        </Link>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-2xl font-bold text-brand-700">{formatMoney(laborCost)}</p>
          <p className="text-xs text-slate-500">Pool labor (30d)</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-2xl font-bold text-slate-900">{Math.round(otHours * 10) / 10}</p>
          <p className="text-xs text-slate-500">OT hours (30d)</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming pool coverage</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No pool nurses scheduled yet. <Link href="/facility/post" className="font-medium text-brand-600">Post a shift →</Link>
          </p>
        ) : (
          <div className="space-y-1">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                <span className="font-medium text-slate-800">{a.nurse.name} <span className="text-xs text-slate-400">· {a.nurse.licenseType}</span></span>
                <span className="text-slate-500">{fmt(a.scheduledStart)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
