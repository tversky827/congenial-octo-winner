"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveHoursRow({
  assignmentId,
  scheduledHours,
}: {
  assignmentId: string;
  scheduledHours: number;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(String(scheduledHours));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedHours: parseFloat(hours) || 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not approve");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          className="input w-20 py-2 text-sm"
          type="number"
          min="0"
          step="0.25"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          disabled={busy}
          aria-label="Approved hours"
        />
        <span className="text-xs text-slate-400">hrs</span>
        <button className="btn-primary flex-1 py-2 text-sm" disabled={busy} onClick={approve}>
          {busy ? "…" : "Approve"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
