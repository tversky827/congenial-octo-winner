"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computePay } from "@/lib/pay";
import { formatHours, formatMoney } from "@/lib/format";

// Combine a date (YYYY-MM-DD) and a time (HH:MM) into a local Date.
// If the end time is earlier than the start time, treat it as an overnight shift.
function buildTimes(date: string, start: string, end: string): { startISO: string; endISO: string } | null {
  if (!date || !start || !end) return null;
  const startDate = new Date(`${date}T${start}`);
  let endDate = new Date(`${date}T${end}`);
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startISO: startDate.toISOString(), endISO: endDate.toISOString() };
}

interface PostShiftFormProps {
  isCorporate: boolean;
  facilities: { id: string; name: string }[];
  facilityName: string | null;
  positions: string[];
}

export function PostShiftForm({ isCorporate, facilities, facilityName, positions }: PostShiftFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    position: "",
    facilityId: "",
    date: "",
    start: "",
    end: "",
    bonus: "",
    notes: "",
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const preview = useMemo(() => {
    const times = buildTimes(form.date, form.start, form.end);
    if (!times) return null;
    const pay = computePay({ startTime: times.startISO, endTime: times.endISO, hourlyRate: 0 });
    return pay.hours;
  }, [form]);

  const bonusNum = parseFloat(form.bonus) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const times = buildTimes(form.date, form.start, form.end);
    if (!times) {
      setError("Please set a date, start time, and end time.");
      return;
    }
    if (isCorporate && !form.facilityId) {
      setError("Please choose a facility for this shift.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: form.position,
          facilityId: form.facilityId,
          startTime: times.startISO,
          endTime: times.endISO,
          bonus: form.bonus || 0,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not post the shift");
        setLoading(false);
        return;
      }
      router.push("/shifts");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-4">
      <div className="card space-y-3">
        {isCorporate ? (
          <div>
            <label className="label" htmlFor="facilityId">Facility</label>
            {facilities.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                No facilities yet. Add one in Admin → Facilities first.
              </p>
            ) : (
              <select className="input" id="facilityId" required value={form.facilityId} onChange={set("facilityId")}>
                <option value="" disabled>Choose a facility…</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Posting to <span className="font-semibold text-slate-800">{facilityName ?? "your facility"}</span>
          </div>
        )}
        <div>
          <label className="label" htmlFor="position">Role needed</label>
          <select className="input" id="position" required value={form.position} onChange={set("position")}>
            <option value="" disabled>Choose…</option>
            {positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input className="input" id="date" type="date" required value={form.date} onChange={set("date")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="start">Start</label>
            <input className="input" id="start" type="time" required value={form.start} onChange={set("start")} />
          </div>
          <div>
            <label className="label" htmlFor="end">End</label>
            <input className="input" id="end" type="time" required value={form.end} onChange={set("end")} />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="bonus">Pick-up bonus ($, optional)</label>
          <input
            className="input"
            id="bonus"
            type="number"
            min="0"
            step="1"
            value={form.bonus}
            onChange={set("bonus")}
            placeholder="e.g. 50"
          />
          <p className="mt-1 text-xs text-slate-400">
            A flat bonus added on top of the employee&apos;s regular pay to help fill this shift.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes (optional)</label>
          <textarea className="input" id="notes" rows={3} value={form.notes} onChange={set("notes")} placeholder="Anything the team should know before claiming." />
        </div>
      </div>

      {preview !== null && (
        <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <p className="text-sm text-brand-800">This shift is</p>
          <p className="text-2xl font-bold text-brand-700">{formatHours(preview)}</p>
          <p className="text-sm text-brand-800/80">
            Each employee earns their hourly rate × {formatHours(preview)}
            {bonusNum > 0 ? ` + ${formatMoney(bonusNum)} pick-up bonus` : ""}.
          </p>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Posting…" : "Post shift"}
      </button>
    </form>
  );
}
