"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export interface SchedShift {
  id: string;
  position: string;
  timeLabel: string;
  bonus: number;
  status: string;
  assignedToId: string | null;
}

export interface SchedDay {
  label: string;
  dateLabel: string;
  shifts: SchedShift[];
}

interface Props {
  facilityId: string;
  facilityName: string;
  isCorporate: boolean;
  facilities: { id: string; name: string }[];
  weekKey: string;
  weekLabel: string;
  prevKey: string;
  nextKey: string;
  scheduleId: string | null;
  published: boolean;
  built: boolean;
  days: SchedDay[];
  staff: { id: string; name: string; position: string }[];
  counts: { total: number; assigned: number; unfilled: number; open: number };
}

export function SchedulerWeek(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hrefFor = (week: string) =>
    `/schedule?week=${week}${props.isCorporate ? `&facility=${props.facilityId}` : ""}`;

  async function call(key: string, fn: () => Promise<Response>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      router.refresh();
    } catch { setError("Network error"); } finally { setBusy(null); }
  }

  const build = () =>
    call("build", () =>
      fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId: props.facilityId, weekStart: props.weekKey }),
      })
    );

  const publish = () =>
    props.scheduleId
      ? call("publish", () => fetch(`/api/schedule/${props.scheduleId}/publish`, { method: "POST" }))
      : undefined;

  const assign = (shiftId: string, workerId: string) =>
    call(shiftId, () =>
      fetch(`/api/shifts/${shiftId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: workerId || null }),
      })
    );

  return (
    <div>
      {/* Facility picker (corporate) */}
      {props.isCorporate && (
        <div className="mb-3">
          <select
            className="input max-w-[14rem] py-2 text-sm"
            value={props.facilityId}
            onChange={(e) => router.push(`/schedule?week=${props.weekKey}&facility=${e.target.value}`)}
          >
            {props.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white px-2 py-2 shadow-sm ring-1 ring-slate-100">
        <Link href={hrefFor(props.prevKey)} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">‹ Prev</Link>
        <span className="text-sm font-semibold text-slate-900">{props.weekLabel}</span>
        <Link href={hrefFor(props.nextKey)} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Next ›</Link>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!props.built ? (
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="mb-3 text-4xl">🗓️</div>
          <h2 className="text-lg font-semibold text-slate-900">No schedule for this week yet</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Build it from {props.facilityName}&apos;s coverage template, then assign your staff.
          </p>
          <button className="btn-primary mt-4" onClick={build} disabled={busy === "build"}>
            {busy === "build" ? "Building…" : "Build week from template"}
          </button>
        </div>
      ) : (
        <>
          {/* Summary + publish */}
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-semibold text-slate-900">
                  {props.counts.assigned}/{props.counts.total} filled
                </p>
                <p className="text-slate-500">
                  {props.published
                    ? `${props.counts.open} open in marketplace`
                    : `${props.counts.unfilled} still unassigned`}
                </p>
              </div>
              {props.published ? (
                <span className="chip bg-emerald-50 text-emerald-700">Published ✓</span>
              ) : (
                <button className="btn-primary text-sm" onClick={publish} disabled={busy === "publish"}>
                  {busy === "publish" ? "Publishing…" : "Publish week"}
                </button>
              )}
            </div>
            {!props.published && (
              <p className="mt-2 text-xs text-slate-400">
                Publishing sends every unassigned shift to the marketplace for staff to claim.
              </p>
            )}
          </div>

          <div className="space-y-4">
            {props.days.filter((d) => d.shifts.length > 0).map((day) => (
              <section key={day.label}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  {day.label} <span className="font-normal text-slate-400">· {day.dateLabel}</span>
                </h3>
                <div className="space-y-2">
                  {day.shifts.map((s) => {
                    const options = props.staff.filter((w) => w.position === s.position);
                    return (
                      <div key={s.id} className="card">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="chip bg-brand-50 text-brand-700">{s.position}</span>
                            {s.bonus > 0 && <span className="chip bg-amber-100 text-amber-800">＋{formatMoney(s.bonus)}</span>}
                            <StatusBadge status={s.status} />
                          </div>
                          <span className="text-sm text-slate-500">{s.timeLabel}</span>
                        </div>
                        <select
                          className="input py-2 text-sm"
                          value={s.assignedToId ?? ""}
                          disabled={busy === s.id}
                          onChange={(e) => assign(s.id, e.target.value)}
                        >
                          <option value="">
                            {props.published ? "Unassigned (in marketplace)" : "Unassigned"}
                          </option>
                          {options.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
