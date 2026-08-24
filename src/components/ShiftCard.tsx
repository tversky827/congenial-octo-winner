"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computePay } from "@/lib/pay";
import { formatDateRange, formatHours, formatMoney, formatRate } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { DeleteShiftButton } from "./DeleteShiftButton";

export interface ShiftCardData {
  id: string;
  title: string;
  position: string;
  facilityName?: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  bonus: number;
  notes: string | null;
  status: string;
}

interface Props {
  shift: ShiftCardData;
  viewerRole: "CORPORATE" | "MANAGER" | "WORKER";
  /** The viewing staff member's hourly rate (drives their personal pay estimate). */
  viewerRate?: number | null;
  myClaimStatus?: string | null;
  claimCount?: number;
  /** Show worker claim/withdraw controls. */
  showActions?: boolean;
}

export function ShiftCard({ shift, viewerRole, viewerRate, myClaimStatus, claimCount = 0, showActions = true }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isStaff = viewerRole === "WORKER";
  const rate = isStaff ? viewerRate ?? 0 : 0;
  const hasRate = rate > 0;

  // Pay = employee rate × hours + the shift's pick-up bonus. For managers /
  // corporate (no single rate) we only use `hours`.
  const pay = computePay({
    startTime: shift.startTime,
    endTime: shift.endTime,
    hourlyRate: rate,
    bonus: shift.bonus,
  });

  async function act(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const claim = () =>
    act(() =>
      fetch(`/api/shifts/${shift.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

  const withdraw = () => act(() => fetch(`/api/shifts/${shift.id}/claim`, { method: "DELETE" }));

  const hasActiveClaim = myClaimStatus === "PENDING" || myClaimStatus === "APPROVED";

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="chip bg-brand-50 text-brand-700">{shift.position}</span>
            {shift.facilityName && (
              <span className="chip bg-slate-100 text-slate-600">🏢 {shift.facilityName}</span>
            )}
            {shift.bonus > 0 && (
              <span className="chip bg-amber-100 text-amber-800">＋{formatMoney(shift.bonus)} bonus</span>
            )}
            <StatusBadge status={shift.status} />
          </div>
          <h3 className="truncate text-base font-semibold text-slate-900">{shift.title}</h3>
          {shift.location && <p className="mt-0.5 text-sm text-slate-500">📍 {shift.location}</p>}
        </div>
        <div className="shrink-0 text-right">
          {isStaff && hasRate ? (
            <>
              <p className="text-xs text-slate-400">You&apos;d earn</p>
              <p className="text-xl font-bold text-brand-700">{formatMoney(pay.total)}</p>
              <p className="text-xs text-slate-400">{formatRate(pay.hourlyRate)}</p>
            </>
          ) : isStaff ? (
            <>
              <p className="text-xs text-slate-400">Your pay</p>
              <p className="text-sm font-semibold text-amber-600">Rate not set</p>
              <p className="text-xs text-slate-400">Ask your manager</p>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">Length</p>
              <p className="text-xl font-bold text-slate-700">{formatHours(pay.hours)}</p>
              <p className="text-xs text-slate-400">pay per staff rate</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <span>🕒 {formatDateRange(shift.startTime, shift.endTime)}</span>
        <span className="font-medium">{formatHours(pay.hours)}</span>
      </div>

      {isStaff && hasRate && (
        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="mt-2 text-xs font-medium text-brand-600 hover:underline"
        >
          {showBreakdown ? "Hide pay details" : "See pay details"}
        </button>
      )}
      {isStaff && hasRate && showBreakdown && (
        <dl className="mt-2 space-y-1 rounded-xl border border-slate-100 p-3 text-sm">
          <Row label={`${formatHours(pay.hours)} × ${formatMoney(pay.hourlyRate)}`} value={formatMoney(pay.basePay)} />
          {pay.bonus > 0 && <Row label="Pick-up bonus" value={`+${formatMoney(pay.bonus)}`} />}
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
            <span>Estimated total</span>
            <span>{formatMoney(pay.total)}</span>
          </div>
        </dl>
      )}

      {shift.notes && <p className="mt-3 text-sm text-slate-600">{shift.notes}</p>}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Worker actions */}
      {viewerRole === "WORKER" && showActions && (
        <div className="mt-4">
          {shift.status === "OPEN" && !hasActiveClaim && (
            <button className="btn-primary w-full" onClick={claim} disabled={busy}>
              {busy ? "Claiming…" : "Claim this shift"}
            </button>
          )}
          {hasActiveClaim && (
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm font-medium text-emerald-700">
                {myClaimStatus === "APPROVED" ? "✅ You're confirmed" : "⏳ Waiting for approval"}
              </div>
              <button className="btn-danger" onClick={withdraw} disabled={busy}>
                Withdraw
              </button>
            </div>
          )}
          {shift.status === "OPEN" && myClaimStatus === "REJECTED" && (
            <button className="btn-secondary w-full" onClick={claim} disabled={busy}>
              Claim again
            </button>
          )}
        </div>
      )}

      {/* Manager / corporate summary */}
      {viewerRole !== "WORKER" && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-500">
          <span>
            {claimCount > 0 ? (
              <span className="font-medium text-brand-700">
                {claimCount} {claimCount === 1 ? "person has" : "people have"} claimed this
              </span>
            ) : shift.status === "OPEN" ? (
              "No claims yet"
            ) : null}
          </span>
          <DeleteShiftButton shiftId={shift.id} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-slate-400" : "text-slate-600"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
