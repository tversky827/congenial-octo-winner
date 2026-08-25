"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

export interface AgencyRow {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  billRate: number;
}

export function AgenciesEditor({ agencies }: { agencies: AgencyRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contactName: "", contactPhone: "", contactEmail: "", billRate: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not add"); return; }
      setForm({ name: "", contactName: "", contactPhone: "", contactEmail: "", billRate: "" });
      router.refresh();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function retire(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/agencies/${id}`, { method: "DELETE" });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <p className="text-sm font-semibold text-slate-900">Add an agency partner</p>
        <div>
          <label className="label">Agency name</label>
          <input className="input py-2 text-sm" value={form.name} onChange={set("name")} placeholder="e.g. CareStaff Partners" required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Contact name</label>
            <input className="input py-2 text-sm" value={form.contactName} onChange={set("contactName")} />
          </div>
          <div>
            <label className="label">Bill rate ($/hr)</label>
            <input className="input py-2 text-sm" type="number" min="0" step="0.01" value={form.billRate} onChange={set("billRate")} placeholder="e.g. 65" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input py-2 text-sm" value={form.contactPhone} onChange={set("contactPhone")} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input py-2 text-sm" value={form.contactEmail} onChange={set("contactEmail")} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Add agency"}</button>
      </form>

      <div className="space-y-1">
        {agencies.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No agencies yet. Add the staffing partners you use to fill open shifts.
          </p>
        ) : agencies.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
            <span>
              <span className="font-semibold text-slate-800">{a.name}</span>
              {a.billRate > 0 && <span className="text-slate-500"> · {formatMoney(a.billRate)}/hr</span>}
              {a.contactName && <span className="text-slate-400"> · {a.contactName}</span>}
            </span>
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => retire(a.id)} disabled={busy}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
