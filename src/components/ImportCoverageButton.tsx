"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Loads the budgeted daily coverage for all facilities in one click.
export function ImportCoverageButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/import-coverage", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not import");
        return;
      }
      const parts = [
        `${data.facilities} facilities`,
        data.facilitiesCreated ? `${data.facilitiesCreated} created` : null,
        data.shiftsCreated ? `${data.shiftsCreated} shifts added` : null,
        data.shiftsUpdated ? `${data.shiftsUpdated} updated` : null,
      ].filter(Boolean);
      setResult(`Loaded budgeted coverage — ${parts.join(" · ")}.`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
      <p className="text-sm font-semibold text-brand-800">Load budgeted coverage</p>
      <p className="mt-1 text-xs text-brand-800/80">
        Creates all facilities and their default daily shifts (CNA &amp; Nurse) from the budget.
        Safe to run more than once — it updates rather than duplicates.
      </p>
      <button className="btn-primary mt-3 w-full" onClick={run} disabled={busy}>
        {busy ? "Loading…" : "Load budgeted coverage"}
      </button>
      {result && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{result}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
