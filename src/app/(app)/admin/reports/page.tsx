import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { orgReport } from "@/lib/analyticsData";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
];

export default async function ReportsPage({ searchParams }: { searchParams: { range?: string } }) {
  const me = (await getCurrentUser())!;
  const range = RANGES.find((r) => r.key === searchParams.range) ?? RANGES[1];

  const to = new Date();
  const from = new Date(to.getTime() - range.days * 24 * 60 * 60 * 1000);

  const facilities = await prisma.facility.findMany({
    where: { active: true, ...orgWhere(me) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const report = await orgReport(facilities, from, to);
  const t = report.totals;

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/reports?range=${r.key}`}
            className={`flex-1 rounded-lg py-1.5 text-center transition ${
              r.key === range.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {facilities.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Add a facility to see reports.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Metric label="Labor cost" value={formatMoney(t.laborCost)} />
            <Metric label="Fill rate" value={`${t.fillRatePct}%`} />
            <Metric label="Hours worked" value={`${t.hoursWorked}h`} />
            <Metric label="Call-offs" value={String(t.callOffs)} />
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{report.facilities.length} facilities</span>
            <span>{t.confirmed}/{t.scheduled} shifts filled · {t.open} still open</span>
          </div>

          <div className="space-y-2">
            {report.facilities.map((f) => (
              <div key={f.facilityId} className="card">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{f.facilityName}</p>
                  <span className="text-sm font-semibold text-brand-700">{f.fillRatePct}% filled</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Labor: <span className="font-medium text-slate-700">{formatMoney(f.labor.totalCost)}</span></span>
                  <span>Worked: <span className="font-medium text-slate-700">{f.labor.hoursWorked}h</span></span>
                  <span>Scheduled: {f.scheduled}</span>
                  <span>Open: {f.open} · Call-offs: {f.callOffs}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            Labor cost uses actual clocked pay where available, otherwise the scheduled projection.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
