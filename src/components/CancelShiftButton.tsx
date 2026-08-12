"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelShiftButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button className="text-xs font-medium text-slate-400 hover:text-red-600" onClick={() => setConfirming(true)}>
        Cancel shift
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">Cancel this shift?</span>
      <button className="font-semibold text-red-600" onClick={cancel} disabled={busy}>
        {busy ? "…" : "Yes"}
      </button>
      <button className="text-slate-400" onClick={() => setConfirming(false)}>
        No
      </button>
    </span>
  );
}
