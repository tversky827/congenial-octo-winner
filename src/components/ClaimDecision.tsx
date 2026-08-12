"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimDecision({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "APPROVED" | "REJECTED">(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => decide("REJECTED")} disabled={busy !== null}>
          {busy === "REJECTED" ? "…" : "Decline"}
        </button>
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => decide("APPROVED")} disabled={busy !== null}>
          {busy === "APPROVED" ? "…" : "Approve"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
