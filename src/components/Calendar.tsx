"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { computePay } from "@/lib/pay";
import { formatMoney, formatHours } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export interface CalendarShift {
  id: string;
  title: string;
  position: string;
  facilityName: string | null;
  startISO: string;
  endISO: string;
  status: string;
  differential: number;
  breakMinutes: number;
  overtimeAfterHours: number;
  overtimeMultiplier: number;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function Calendar({
  shifts,
  viewerRate,
  showFacility,
}: {
  shifts: CalendarShift[];
  viewerRate?: number | null;
  showFacility?: boolean;
}) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState<string>(dayKey(today));

  // Group shifts by local calendar day.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarShift[]>();
    for (const s of shifts) {
      const key = dayKey(new Date(s.startISO));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  const firstOfMonth = new Date(view.year, view.month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.year, view.month, d));

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  const selectedShifts = (byDay.get(selectedKey) ?? []).sort(
    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );
  const selectedDate = selectedShifts[0]
    ? new Date(selectedShifts[0].startISO)
    : parseKey(selectedKey);

  return (
    <div>
      <div className="card mb-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100" aria-label="Previous month">‹</button>
          <p className="font-semibold text-slate-900">{MONTHS[view.month]} {view.year}</p>
          <button onClick={() => shiftMonth(1)} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100" aria-label="Next month">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
          {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const key = dayKey(date);
            const count = byDay.get(key)?.length ?? 0;
            const isToday = key === dayKey(today);
            const isSelected = key === selectedKey;
            return (
              <button
                key={i}
                onClick={() => setSelectedKey(key)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition ${
                  isSelected ? "bg-brand-600 text-white" : isToday ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {date.getDate()}
                {count > 0 && (
                  <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand-500"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </h2>
      {selectedShifts.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">No shifts this day.</p>
      ) : (
        <div className="space-y-2">
          {selectedShifts.map((s) => {
            const start = new Date(s.startISO);
            const end = new Date(s.endISO);
            const pay = computePay({
              startTime: s.startISO,
              endTime: s.endISO,
              hourlyRate: viewerRate ?? 0,
              differential: s.differential,
              breakMinutes: s.breakMinutes,
              overtimeAfterHours: s.overtimeAfterHours,
              overtimeMultiplier: s.overtimeMultiplier,
            });
            const time = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
            return (
              <Link key={s.id} href="/shifts" className="card block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="chip bg-brand-50 text-brand-700">{s.position}</span>
                      {showFacility && s.facilityName && (
                        <span className="chip bg-slate-100 text-slate-600">🏢 {s.facilityName}</span>
                      )}
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="truncate font-semibold text-slate-900">{s.title}</p>
                    <p className="text-sm text-slate-500">🕒 {time}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {viewerRate && viewerRate > 0 ? (
                      <>
                        <p className="text-xs text-slate-400">You&apos;d earn</p>
                        <p className="text-base font-bold text-brand-700">{formatMoney(pay.total)}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-slate-600">{formatHours(pay.paidHours)}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m, d);
}
