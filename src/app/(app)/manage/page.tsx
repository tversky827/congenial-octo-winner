import { redirect } from "next/navigation";
import { getCurrentUser, canManage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { facilityScopeWhere } from "@/lib/access";
import { orgWhere, orgViaFacilityWhere } from "@/lib/tenant";
import { computePay } from "@/lib/pay";
import { formatDateRange, formatHours, formatMoney, formatRelativeTime } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { ClaimDecision } from "@/components/ClaimDecision";
import { CancelShiftButton } from "@/components/CancelShiftButton";
import { FacilityFilter } from "@/components/FacilityFilter";
import { PageHeader, EmptyState } from "@/components/Page";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: { facility?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManage(user)) redirect("/shifts");

  const selectedFacility = user.role === "CORPORATE" ? searchParams.facility || null : null;

  const shifts = await prisma.shift.findMany({
    where: {
      status: "OPEN",
      claims: { some: { status: "PENDING" } },
      ...facilityScopeWhere(user, selectedFacility),
      ...orgViaFacilityWhere(user),
    },
    orderBy: { startTime: "asc" },
    include: {
      facility: { select: { name: true } },
      claims: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { worker: true },
      },
    },
  });

  const pendingCount = shifts.reduce((n, s) => n + s.claims.length, 0);

  let facilityFilter: React.ReactNode = null;
  if (user.role === "CORPORATE") {
    const facilities = await prisma.facility.findMany({
      where: { active: true, ...orgWhere(user) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    facilityFilter = <FacilityFilter facilities={facilities} />;
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={pendingCount > 0 ? `${pendingCount} claim${pendingCount === 1 ? "" : "s"} waiting on you` : "Review and assign claimed shifts."}
      />
      {facilityFilter && <div className="mb-4">{facilityFilter}</div>}

      {shifts.length === 0 ? (
        <EmptyState emoji="✅" title="You're all caught up" body="No claims are waiting for approval right now." />
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const pay = computePay({
              startTime: shift.startTime,
              endTime: shift.endTime,
              hourlyRate: 0,
              bonus: shift.bonus,
            });
            return (
              <div key={shift.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="chip bg-brand-50 text-brand-700">{shift.position}</span>
                      {shift.facility && (
                        <span className="chip bg-slate-100 text-slate-600">🏢 {shift.facility.name}</span>
                      )}
                      <StatusBadge status={shift.status} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{shift.title}</h3>
                    {shift.location && <p className="text-sm text-slate-500">📍 {shift.location}</p>}
                    <p className="text-sm text-slate-500">🕒 {formatDateRange(shift.startTime, shift.endTime)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Length</p>
                    <p className="text-lg font-bold text-slate-700">{formatHours(pay.hours)}</p>
                    {shift.bonus > 0 && (
                      <p className="text-xs font-medium text-amber-600">＋{formatMoney(shift.bonus)} bonus</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {shift.claims.length} claimed this shift
                  </p>
                  {shift.claims.map((claim) => {
                    const workerPay = computePay({
                      startTime: shift.startTime,
                      endTime: shift.endTime,
                      hourlyRate: claim.worker.baseRate,
                      bonus: shift.bonus,
                    });
                    return (
                      <div key={claim.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {claim.worker.name}
                            {claim.worker.position ? <span className="text-slate-400"> · {claim.worker.position}</span> : null}
                          </p>
                          <p className="text-xs text-slate-400">
                            Claimed {formatRelativeTime(claim.createdAt)} ·{" "}
                            {claim.worker.baseRate > 0 ? (
                              <span className="font-medium text-brand-700">
                                {formatMoney(workerPay.total)} for them
                              </span>
                            ) : (
                              <span className="text-amber-600">rate not set</span>
                            )}
                          </p>
                          {claim.message && <p className="mt-0.5 text-xs text-slate-500">“{claim.message}”</p>}
                        </div>
                        <ClaimDecision claimId={claim.id} />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-end">
                  <CancelShiftButton shiftId={shift.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
