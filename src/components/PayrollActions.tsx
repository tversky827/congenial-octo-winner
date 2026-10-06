"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayrollActions({ periodId, canFinalize }: { periodId?: string; canFinalize?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [form, setForm] = useState({ startDate: "", endDate: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payroll/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create period");
        return;
      }
      router.push(`/admin/payroll?period=${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function finalize(override: boolean) {
    if (!periodId) return;
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.reconciliation && !data.reconciliation.balanced) {
        setBlocked(data.reason || "Reconciliation failed.");
        return;
      }
      if (!res.ok || data.ok === false) {
        setError(data.reason || data.error || "Could not finalize");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (periodId) {
    return (
      <div className="space-y-2">
        {canFinalize && (
          <button className="btn-primary w-full" disabled={busy} onClick={() => finalize(false)}>
            {busy ? "Finalizing…" : "Finalize period"}
          </button>
        )}
        {blocked && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            <p className="font-semibold">Reconciliation failed — finalize is blocked.</p>
            <p className="mt-0.5">{blocked}</p>
            <button
              className="mt-2 font-medium text-red-700 underline"
              disabled={busy}
              onClick={() => finalize(true)}
            >
              Override and finalize anyway (recorded in the audit log)
            </button>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={create} className="card space-y-3">
      <p className="text-sm font-semibold text-slate-900">New payroll period</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Start</label>
          <input className="input py-2 text-sm" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        </div>
        <div>
          <label className="label">End</label>
          <input className="input py-2 text-sm" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Create period"}</button>
    </form>
  );
}
