"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

export interface TemplateEntry {
  id: string;
  position: string;
  startTime: string;
  endTime: string;
  count: number;
  bonus: number;
}

export function TemplateEditor({
  facilityId,
  entries,
  positions,
}: {
  facilityId: string;
  entries: TemplateEntry[];
  positions: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    position: positions[0] ?? "",
    startTime: "07:00",
    endTime: "15:00",
    count: "1",
    bonus: "0",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not add"); return; }
      router.refresh();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/template/${id}`, { method: "DELETE" });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <p className="text-sm font-semibold text-slate-900">Add a daily shift</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Role</label>
            <select className="input py-2 text-sm" value={form.position} onChange={set("position")}>
              {positions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">How many</label>
            <input className="input py-2 text-sm" type="number" min="1" step="1" value={form.count} onChange={set("count")} required />
          </div>
          <div>
            <label className="label">Start</label>
            <input className="input py-2 text-sm" type="time" value={form.startTime} onChange={set("startTime")} required />
          </div>
          <div>
            <label className="label">End</label>
            <input className="input py-2 text-sm" type="time" value={form.endTime} onChange={set("endTime")} required />
          </div>
          <div className="col-span-2">
            <label className="label">Bonus ($, optional)</label>
            <input className="input py-2 text-sm" type="number" min="0" step="1" value={form.bonus} onChange={set("bonus")} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Add to daily budget"}</button>
      </form>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Every day, this facility needs</p>
        {entries.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            Nothing set yet. Add the shifts you need each day above — the scheduler builds every
            week from this.
          </p>
        ) : (
          <div className="space-y-1">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                <span>
                  <span className="font-semibold text-slate-800">{e.count}× {e.position}</span>
                  <span className="text-slate-500"> · {e.startTime}–{e.endTime}</span>
                  {e.bonus > 0 && <span className="text-amber-600"> · +{formatMoney(e.bonus)}</span>}
                </span>
                <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => remove(e.id)} disabled={busy}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
