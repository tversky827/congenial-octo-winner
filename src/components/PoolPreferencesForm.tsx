"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" },
  { n: 4, label: "Thu" }, { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 0, label: "Sun" },
];

export function PoolPreferencesForm({
  facilities,
  initial,
}: {
  facilities: { id: string; name: string }[];
  initial: { minRate: number | null; facilityIds: string[]; daysOfWeek: number[]; notifyEmail: boolean; notifySms: boolean; phone: string };
}) {
  const router = useRouter();
  const [minRate, setMinRate] = useState(initial.minRate != null ? String(initial.minRate) : "");
  const [facs, setFacs] = useState<Set<string>>(new Set(initial.facilityIds));
  const [days, setDays] = useState<Set<number>>(new Set(initial.daysOfWeek));
  const [notifyEmail, setNotifyEmail] = useState(initial.notifyEmail);
  const [notifySms, setNotifySms] = useState(initial.notifySms);
  const [phone, setPhone] = useState(initial.phone);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  };

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/pool/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minRate: minRate === "" ? null : parseFloat(minRate),
          facilityIds: [...facs],
          daysOfWeek: [...days],
          notifyEmail,
          notifySms,
          phone,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not save");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <label className="label">Only alert me about shifts paying at least
          <input className="input mt-1 py-2 text-sm" type="number" min="0" step="0.5" placeholder="Any rate" value={minRate} onChange={(e) => setMinRate(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <p className="mb-2 text-sm font-semibold text-slate-900">Preferred facilities</p>
        <p className="mb-2 text-xs text-slate-500">Leave all unchecked for any facility you&apos;re eligible for.</p>
        <div className="flex flex-wrap gap-2">
          {facilities.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFacs(toggle(facs, f.id))}
              className={`chip ${facs.has(f.id) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="mb-2 text-sm font-semibold text-slate-900">Preferred days</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.n}
              type="button"
              onClick={() => setDays(toggle(days, d.n))}
              className={`chip ${days.has(d.n) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <p className="text-sm font-semibold text-slate-900">How to reach you</p>
        <label className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Email me about matching shifts</span>
          <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Text me about matching shifts</span>
          <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />
        </label>
        {notifySms && (
          <label className="block text-xs text-slate-500">
            Mobile number
            <input className="input mt-1 py-2 text-sm" type="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <span className="mt-1 block text-[11px] text-slate-400">Standard message &amp; data rates may apply.</span>
          </label>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}
      <button className="btn-primary w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save preferences"}</button>
    </div>
  );
}
