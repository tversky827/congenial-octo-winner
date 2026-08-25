"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClockState = "not-in" | "in" | "done";

export function TimeClock({
  shiftId,
  initialState,
  clockInAt,
  actualMinutes,
}: {
  shiftId: string;
  initialState: ClockState;
  clockInAt: string | null;
  actualMinutes: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function punch(action: "in" | "out") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not record");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (initialState === "done") {
    const h = actualMinutes != null ? Math.floor(actualMinutes / 60) : 0;
    const m = actualMinutes != null ? actualMinutes % 60 : 0;
    return (
      <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
        ✓ Clocked out · {h}h {m}m worked
      </p>
    );
  }

  return (
    <div className="mt-2">
      {initialState === "in" ? (
        <button
          className="w-full rounded-xl bg-slate-800 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => punch("out")}
        >
          {busy ? "…" : "Clock out"}
          {clockInAt && (
            <span className="ml-1 font-normal text-white/70">
              (in since {new Date(clockInAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})
            </span>
          )}
        </button>
      ) : (
        <button
          className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => punch("in")}
        >
          {busy ? "…" : "Clock in"}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
