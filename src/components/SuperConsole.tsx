"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

export interface OrgRow {
  id: string;
  name: string;
  active: boolean;
  facilities: number;
  seats: number;
  shiftsLast30: number;
  monthlyTotal: number;
}

export function SuperConsole({
  orgs,
  totals,
}: {
  orgs: OrgRow[];
  totals: { orgs: number; facilities: number; seats: number; mrr: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string, active: boolean) {
    setBusy(id);
    try {
      await fetch(`/api/super/orgs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Metric label="Organizations" value={String(totals.orgs)} />
        <Metric label="Est. MRR" value={formatMoney(totals.mrr)} />
        <Metric label="Facilities" value={String(totals.facilities)} />
        <Metric label="Seats" value={String(totals.seats)} />
      </div>

      <div className="space-y-2">
        {orgs.map((o) => (
          <div key={o.id} className={`card ${o.active ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{o.name}</p>
                <p className="text-xs text-slate-500">
                  {o.facilities} facilities · {o.seats} seats · {o.shiftsLast30} shifts/30d
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-brand-700">{formatMoney(o.monthlyTotal)}/mo</p>
                <button
                  className={`text-xs font-medium ${o.active ? "text-slate-400 hover:text-red-600" : "text-emerald-600"}`}
                  disabled={busy === o.id}
                  onClick={() => toggle(o.id, !o.active)}
                >
                  {o.active ? "Suspend" : "Reactivate"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
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

// Shown to a corporate admin who hasn't claimed platform access yet.
export function SuperClaim() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/super/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not verify");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="text-sm font-semibold text-slate-900">Platform access</p>
      <p className="text-xs text-slate-500">
        Enter the platform operator code to manage every organization.
      </p>
      <input
        className="input"
        type="password"
        placeholder="Platform code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Unlock console"}</button>
    </form>
  );
}
