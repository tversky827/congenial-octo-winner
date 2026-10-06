"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function buildISO(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function PoolShiftPostForm({ facilities }: { facilities: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({
    facilityId: facilities[0]?.id ?? "",
    requiredLicense: "RN",
    date: "",
    start: "07:00",
    end: "15:00",
    nursesNeeded: "1",
    differentialPerHour: "0",
    notes: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const startTime = buildISO(form.date, form.start);
    let endTime = buildISO(form.date, form.end);
    if (!startTime || !endTime) {
      setError("Set a date, start and end time.");
      return;
    }
    // Overnight shift → roll end to next day.
    if (new Date(endTime) <= new Date(startTime)) {
      endTime = new Date(new Date(endTime).getTime() + 86400000).toISOString();
    }
    setBusy(true);
    try {
      const res = await fetch("/api/pool/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startTime, endTime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not post");
        return;
      }
      setOk(`Posted. Notified ${data.notified ?? 0} matching nurse${data.notified === 1 ? "" : "s"}.`);
      setForm((f) => ({ ...f, date: "", notes: "" }));
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="text-sm font-semibold text-slate-900">Post a pool shift</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="label col-span-2">Facility
          <select className="input mt-1 py-2 text-sm" value={form.facilityId} onChange={set("facilityId")} required>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="label">License
          <select className="input mt-1 py-2 text-sm" value={form.requiredLicense} onChange={set("requiredLicense")}>
            <option value="RN">RN</option>
            <option value="LPN">LPN</option>
          </select>
        </label>
        <label className="label">Nurses needed
          <input className="input mt-1 py-2 text-sm" type="number" min="1" step="1" value={form.nursesNeeded} onChange={set("nursesNeeded")} />
        </label>
        <label className="label col-span-2">Date
          <input className="input mt-1 py-2 text-sm" type="date" value={form.date} onChange={set("date")} required />
        </label>
        <label className="label">Start
          <input className="input mt-1 py-2 text-sm" type="time" value={form.start} onChange={set("start")} required />
        </label>
        <label className="label">End
          <input className="input mt-1 py-2 text-sm" type="time" value={form.end} onChange={set("end")} required />
        </label>
        <label className="label col-span-2">Differential ($/hr, optional)
          <input className="input mt-1 py-2 text-sm" type="number" min="0" step="0.5" value={form.differentialPerHour} onChange={set("differentialPerHour")} />
        </label>
        <label className="label col-span-2">Notes (optional)
          <textarea className="input mt-1 py-2 text-sm" rows={2} value={form.notes} onChange={set("notes")} />
        </label>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      <button className="btn-primary w-full" disabled={busy || facilities.length === 0}>{busy ? "Posting…" : "Post & notify nurses"}</button>
    </form>
  );
}
