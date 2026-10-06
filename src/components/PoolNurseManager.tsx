"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

export interface PoolNurseRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  licenseType: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null; // YYYY-MM-DD
  baseRate: number;
  eligibility: Record<string, { active: boolean; orientationComplete: boolean }>;
}

export interface FacilityRef {
  id: string;
  name: string;
}

export function PoolNurseManager({
  nurses,
  facilities,
}: {
  nurses: PoolNurseRow[];
  facilities: FacilityRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", licenseType: "RN", licenseNumber: "", licenseExpiry: "", baseRate: "" });

  async function call(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addNurse(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(() =>
      fetch("/api/pool/nurses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    );
    if (ok) setForm({ name: "", email: "", licenseType: "RN", licenseNumber: "", licenseExpiry: "", baseRate: "" });
  }

  const update = (id: string, body: Record<string, unknown>) =>
    call(() => fetch(`/api/pool/nurses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

  const setElig = (id: string, facilityId: string, body: { active?: boolean; orientationComplete?: boolean }) =>
    call(() => fetch(`/api/pool/nurses/${id}/eligibility`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facilityId, ...body }) }));

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Add / convert */}
      <form onSubmit={addNurse} className="card space-y-3">
        <p className="text-sm font-semibold text-slate-900">Add a pool nurse</p>
        <p className="text-xs text-slate-500">
          Creates a new Nurse Pool account, or converts an existing person (same email) into a pool nurse.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input className="input py-2 text-sm" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input py-2 text-sm" type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input py-2 text-sm" placeholder="License (RN, LPN…)" value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })} required />
          <input className="input py-2 text-sm" type="number" min="0" step="0.01" placeholder="Pay rate $/hr" value={form.baseRate} onChange={(e) => setForm({ ...form, baseRate: e.target.value })} />
          <input className="input py-2 text-sm" placeholder="License # (optional)" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
          <input className="input py-2 text-sm" type="date" aria-label="License expiry" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Add pool nurse"}</button>
      </form>

      {/* Roster */}
      <div className="space-y-2">
        {nurses.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No pool nurses yet.</p>}
        {nurses.map((n) => {
          const eligibleCount = Object.values(n.eligibility).filter((e) => e.active).length;
          return (
            <div key={n.id} className={`card ${n.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{n.name}</p>
                  <p className="truncate text-xs text-slate-500">{n.email}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {n.licenseType ?? "—"} · {formatMoney(n.baseRate)}/hr · eligible at {eligibleCount}/{facilities.length}
                  </p>
                </div>
                <button className="text-xs font-medium text-brand-600" onClick={() => setOpen(open === n.id ? null : n.id)}>
                  {open === n.id ? "Close" : "Manage"}
                </button>
              </div>

              {open === n.id && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  {/* Profile */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-500">
                      License
                      <input className="input mt-1 py-2 text-sm" defaultValue={n.licenseType ?? ""} onBlur={(e) => e.target.value !== (n.licenseType ?? "") && update(n.id, { licenseType: e.target.value })} />
                    </label>
                    <label className="text-xs text-slate-500">
                      Pay rate ($/hr)
                      <input className="input mt-1 py-2 text-sm" type="number" min="0" step="0.01" defaultValue={n.baseRate || ""} onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== n.baseRate) update(n.id, { baseRate: v }); }} />
                    </label>
                    <label className="text-xs text-slate-500">
                      License #
                      <input className="input mt-1 py-2 text-sm" defaultValue={n.licenseNumber ?? ""} onBlur={(e) => e.target.value !== (n.licenseNumber ?? "") && update(n.id, { licenseNumber: e.target.value })} />
                    </label>
                    <label className="text-xs text-slate-500">
                      License expiry
                      <input className="input mt-1 py-2 text-sm" type="date" defaultValue={n.licenseExpiry ?? ""} onBlur={(e) => e.target.value !== (n.licenseExpiry ?? "") && update(n.id, { licenseExpiry: e.target.value })} />
                    </label>
                  </div>

                  {/* Eligibility */}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Facility eligibility</p>
                    <div className="space-y-1">
                      {facilities.map((f) => {
                        const e = n.eligibility[f.id] ?? { active: false, orientationComplete: false };
                        return (
                          <div key={f.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-sm">
                            <span className="text-slate-700">{f.name}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={e.active} disabled={busy} onChange={(ev) => setElig(n.id, f.id, { active: ev.target.checked, orientationComplete: e.orientationComplete })} />
                                Eligible
                              </label>
                              <label className={`flex items-center gap-1 ${e.active ? "" : "opacity-40"}`}>
                                <input type="checkbox" checked={e.orientationComplete} disabled={busy || !e.active} onChange={(ev) => setElig(n.id, f.id, { active: e.active, orientationComplete: ev.target.checked })} />
                                Oriented
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">A nurse can claim shifts only where they&apos;re eligible <em>and</em> oriented.</p>
                  </div>

                  <div className="flex justify-end">
                    <button className="text-xs font-medium text-slate-400 hover:text-red-600" disabled={busy} onClick={() => update(n.id, { active: !n.active })}>
                      {n.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
