"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PoolClaimButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pool/shifts/${shiftId}/claim`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not claim");
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
      <button className="btn-primary w-full" disabled={busy} onClick={claim}>
        {busy ? "Claiming…" : "Claim shift"}
      </button>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
