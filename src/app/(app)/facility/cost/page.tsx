import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "60", label: "60 days", days: 60 },
  { key: "90", label: "90 days", days: 90 },
];

export default async function FacilityCostPage({ searchParams }: { searchParams: { range?: string } }) {
  const me = (await getCurrentUser())!;
  const facilityId = me.facilityId;
  if (!facilityId) return null;

  const range = RANGES.find((r) => r.key === searchParams.range) ?? RANGES[0];
  const to = new Date();
  const from = new Date(to.getTime() - range.days * 24 * 60 * 60 * 1000);

  const allocations = await prisma.laborCostAllocation.findMany({
    where: { facilityId, assignment: { scheduledStart: { gte: from, lt: to } } },
    include: { nurse: { select: { name: true } } },
  });

  const totals = allocations.reduce(
    (acc, a) => ({
      regularHours: acc.regularHours + a.regularHours,
      overtimeHours: acc.overtimeHours + a.overtimeHours,
      total: acc.total + a.totalAllocated,
    }),
    { regularHours: 0, overtimeHours: 0, total: 0 }
  );

  // Group by nurse.
  const byNurse = new Map<string, { name: string; hours: number; total: number }>();
  for (const a of allocations) {
    const cur = byNurse.get(a.nurseId) ?? { name: a.nurse.name, hours: 0, total: 0 };
    cur.hours += a.regularHours + a.overtimeHours;
    cur.total += a.totalAllocated;
    byNurse.set(a.nurseId, cur);
  }
  const nurses = [...byNurse.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        {RANGES.map((r) => (
          <Link key={r.key} href={`/facility/cost?range=${r.key}`} className={`flex-1 rounded-lg py-1.5 text-center ${r.key === range.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><p className="text-xl font-bold text-brand-700">{formatMoney(totals.total)}</p><p className="text-xs text-slate-500">Pool labor</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><p className="text-xl font-bold">{Math.round(totals.regularHours)}</p><p className="text-xs text-slate-500">Reg hrs</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><p className="text-xl font-bold">{Math.round(totals.overtimeHours)}</p><p className="text-xs text-slate-500">OT hrs</p></div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">By nurse</h2>
        {nurses.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No allocated pool labor yet — costs appear here once payroll is finalized.
          </p>
        ) : (
          <div className="space-y-1">
            {nurses.map((n) => (
              <div key={n.name} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                <span className="text-slate-700">{n.name} <span className="text-xs text-slate-400">· {Math.round(n.hours)}h</span></span>
                <span className="font-semibold">{formatMoney(n.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-[11px] text-slate-400">Your facility&apos;s Nurse Pool labor cost, from the allocation ledger.</p>
    </div>
  );
}
