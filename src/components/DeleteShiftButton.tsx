"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteShiftButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not delete");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        className="text-xs font-medium text-slate-400 hover:text-red-600"
        onClick={() => setConfirming(true)}
      >
        Delete shift
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      {error ? <span className="text-red-600">{error}</span> : <span className="text-slate-500">Delete this shift?</span>}
      <button className="font-semibold text-red-600" onClick={del} disabled={busy}>
        {busy ? "…" : "Yes, delete"}
      </button>
      <button className="text-slate-400" onClick={() => { setConfirming(false); setError(null); }}>
        No
      </button>
    </span>
  );
}
