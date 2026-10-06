import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { reconcilePeriod } from "@/lib/poolReports";
import { PayrollActions } from "@/components/PayrollActions";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function AdminPayrollPage({ searchParams }: { searchParams: { period?: string } }) {
  const me = (await getCurrentUser())!;

  const periods = await prisma.payrollPeriod.findMany({
    where: { ...(me.organizationId ? { organizationId: me.organizationId } : {}) },
    orderBy: { startDate: "desc" },
    take: 24,
  });

  const selectedId = searchParams.period || periods[0]?.id;
  const selected = selectedId ? periods.find((p) => p.id === selectedId) : undefined;
  const recon = selected ? await reconcilePeriod(selected.id) : null;

  // Payroll total (sum of records) for the selected period.
  const records = selected
    ? await prisma.payrollRecord.findMany({
        where: { payrollPeriodId: selected.id },
        include: { nurse: { select: { name: true } } },
        orderBy: { grossPay: "desc" },
      })
    : [];
  const payrollTotal = records.reduce((s, r) => s + r.grossPay, 0);

  const exportHref = selected
    ? `/api/reports/accounting-export?from=${selected.startDate.toISOString()}&to=${selected.endDate.toISOString()}`
    : "#";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Finalize a period to generate Nurse Pool payroll and allocate each nurse&apos;s labor to the
        facility where they worked. Finalizing is blocked unless payroll reconciles to the facility
        allocations.
      </p>

      <PayrollActions />

      {/* Period picker */}
      {periods.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/admin/payroll?period=${p.id}`}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium ring-1 ${
                p.id === selectedId ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200"
              }`}
            >
              {fmtDay(p.startDate)}–{fmtDay(p.endDate)}
            </Link>
          ))}
        </div>
      )}

      {selected && recon && (
        <>
          {/* Reconciliation */}
          <div className={`card ${recon.balanced ? "bg-emerald-50" : "bg-red-50"}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {recon.balanced ? "✓ Reconciled" : "⚠ Not reconciled"} · {selected.status}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-xs text-slate-500">Pool payroll</p><p className="font-bold">{formatMoney(recon.payrollTotal)}</p></div>
              <div><p className="text-xs text-slate-500">Allocated</p><p className="font-bold">{formatMoney(recon.allocatedTotal)}</p></div>
              <div><p className="text-xs text-slate-500">Difference</p><p className={`font-bold ${recon.difference === 0 ? "" : "text-red-600"}`}>{formatMoney(recon.difference)}</p></div>
            </div>
          </div>

          <PayrollActions periodId={selected.id} canFinalize={["OPEN", "PROCESSING"].includes(selected.status)} />

          {/* Cost by facility */}
          {recon.byFacility.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Cost by facility</h2>
              <div className="space-y-1">
                {recon.byFacility.map((f) => (
                  <div key={f.facilityId} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                    <span className="font-medium text-slate-700">{f.facilityName}</span>
                    <span className="font-semibold text-brand-700">{formatMoney(f.totalLabor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payroll records */}
          {records.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Pool payroll · {formatMoney(payrollTotal)}
              </h2>
              <div className="space-y-1">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                    <span className="text-slate-700">{r.nurse.name} <span className="text-xs text-slate-400">· {r.regularHours}h reg{r.overtimeHours > 0 ? ` · ${r.overtimeHours}h OT` : ""}</span></span>
                    <span className="font-semibold">{formatMoney(r.grossPay)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <a href={exportHref} className="flex items-center justify-center rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white">
            ⬇ Accounting export (CSV)
          </a>
        </>
      )}

      {periods.length === 0 && (
        <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          No payroll periods yet. Create one above to get started.
        </p>
      )}
    </div>
  );
}
