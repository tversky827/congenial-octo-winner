"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { POSITIONS } from "@/lib/positions";
import { DAY_LABELS_LONG } from "@/lib/week";
import { formatMoney } from "@/lib/format";

export interface TemplateEntry {
  id: string;
  position: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  count: number;
  bonus: number;
}

export function TemplateEditor({
  facilityId,
  entries,
}: {
  facilityId: string;
  entries: TemplateEntry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    position: "CNA",
    dayOfWeek: "0",
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

  // Group entries by day for display.
  const byDay = DAY_LABELS_LONG.map((label, day) => ({
    label,
    items: entries.filter((e) => e.dayOfWeek === day),
  }));

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3">
        <p className="text-sm font-semibold text-slate-900">Add a required shift</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Role</label>
            <select className="input py-2 text-sm" value={form.position} onChange={set("position")}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Day</label>
            <select className="input py-2 text-sm" value={form.dayOfWeek} onChange={set("dayOfWeek")}>
              {DAY_LABELS_LONG.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Start</label>
            <input className="input py-2 text-sm" type="time" value={form.startTime} onChange={set("startTime")} required />
          </div>
          <div>
            <label className="label">End</label>
            <input className="input py-2 text-sm" type="time" value={form.endTime} onChange={set("endTime")} required />
          </div>
          <div>
            <label className="label">How many</label>
            <input className="input py-2 text-sm" type="number" min="1" step="1" value={form.count} onChange={set("count")} required />
          </div>
          <div>
            <label className="label">Bonus ($, optional)</label>
            <input className="input py-2 text-sm" type="number" min="0" step="1" value={form.bonus} onChange={set("bonus")} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Add to template"}</button>
      </form>

      <div className="space-y-3">
        {entries.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            No coverage set for this facility yet. Add the shifts you need each week above — the
            scheduler will build the week from this.
          </p>
        )}
        {byDay.filter((d) => d.items.length > 0).map((d) => (
          <div key={d.label}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{d.label}</p>
            <div className="space-y-1">
              {d.items.map((e) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}
