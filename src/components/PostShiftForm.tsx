"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computePay } from "@/lib/pay";
import { formatMoney, formatHours } from "@/lib/format";

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

export function PostShiftForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    title: "",
    position: "",
    location: "",
    date: "",
    start: "",
    end: "",
    hourlyRate: "",
    differential: "0",
    breakMinutes: "0",
    overtimeAfterHours: "8",
    overtimeMultiplier: "1.5",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const preview = useMemo(() => {
    const times = buildTimes(form.date, form.start, form.end);
    const rate = parseFloat(form.hourlyRate);
    if (!times || isNaN(rate)) return null;
    return computePay({
      startTime: times.startISO,
      endTime: times.endISO,
      hourlyRate: rate,
      differential: parseFloat(form.differential) || 0,
      breakMinutes: parseInt(form.breakMinutes) || 0,
      overtimeAfterHours: parseFloat(form.overtimeAfterHours) || 8,
      overtimeMultiplier: parseFloat(form.overtimeMultiplier) || 1.5,
    });
  }, [form]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const times = buildTimes(form.date, form.start, form.end);
    if (!times) {
      setError("Please set a date, start time, and end time.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          position: form.position,
          location: form.location,
          startTime: times.startISO,
          endTime: times.endISO,
          hourlyRate: form.hourlyRate,
          differential: form.differential,
          breakMinutes: form.breakMinutes,
          overtimeAfterHours: form.overtimeAfterHours,
          overtimeMultiplier: form.overtimeMultiplier,
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
        <div>
          <label className="label" htmlFor="title">Shift title</label>
          <input className="input" id="title" required value={form.title} onChange={set("title")} placeholder="e.g. Day shift — Memory Care" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="position">Role needed</label>
            <input className="input" id="position" required value={form.position} onChange={set("position")} placeholder="CNA" />
          </div>
          <div>
            <label className="label" htmlFor="location">Location</label>
            <input className="input" id="location" required value={form.location} onChange={set("location")} placeholder="Sunrise House" />
          </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="hourlyRate">Hourly rate ($)</label>
            <input className="input" id="hourlyRate" type="number" min="0" step="0.01" required value={form.hourlyRate} onChange={set("hourlyRate")} placeholder="24.00" />
          </div>
          <div>
            <label className="label" htmlFor="differential">Differential ($/hr)</label>
            <input className="input" id="differential" type="number" min="0" step="0.01" value={form.differential} onChange={set("differential")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="breakMinutes">Unpaid break (minutes)</label>
          <input className="input" id="breakMinutes" type="number" min="0" step="5" value={form.breakMinutes} onChange={set("breakMinutes")} />
        </div>

        <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide overtime settings" : "Overtime settings"}
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ot">Overtime after (hrs)</label>
              <input className="input" id="ot" type="number" min="0" step="0.5" value={form.overtimeAfterHours} onChange={set("overtimeAfterHours")} />
            </div>
            <div>
              <label className="label" htmlFor="otm">Overtime multiplier</label>
              <input className="input" id="otm" type="number" min="1" step="0.1" value={form.overtimeMultiplier} onChange={set("overtimeMultiplier")} />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea className="input" id="notes" rows={3} value={form.notes} onChange={set("notes")} placeholder="Anything the team should know before claiming." />
      </div>

      {preview && (
        <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <p className="text-sm text-brand-800">Your team will see</p>
          <p className="text-2xl font-bold text-brand-700">{formatMoney(preview.total)}</p>
          <p className="text-sm text-brand-800/80">
            for {formatHours(preview.paidHours)} of work
            {preview.overtimeHours > 0 && ` (incl. ${formatHours(preview.overtimeHours)} OT)`}
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
