"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Lets an assigned employee call off a shift they're confirmed for. Opens a
// small confirm panel with an optional reason, then reopens the shift server-side.
export function CallOffButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/call-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not call off");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-slate-400 hover:text-red-600"
      >
        Call off this shift
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-100">
      <p className="text-xs font-medium text-red-800">
        Call off this shift? It reopens for someone else to pick up.
      </p>
      <input
        className="input mt-2 py-2 text-sm"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button className="btn-primary flex-1 py-2 text-sm" disabled={busy} onClick={submit}>
          {busy ? "…" : "Confirm call-off"}
        </button>
        <button className="btn-secondary py-2 text-sm" disabled={busy} onClick={() => setOpen(false)}>
          Keep it
        </button>
      </div>
    </div>
  );
}
