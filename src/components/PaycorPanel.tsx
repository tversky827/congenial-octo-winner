"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Status {
  configured: boolean;
  missingVars: string[];
  syncedEmployees: number;
  lastSyncAt: string | null;
}

interface SyncResult {
  ok: boolean;
  error?: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  skippedByReason: Record<string, number>;
}

const REASON_LABEL: Record<string, string> = {
  "no-email": "no email",
  inactive: "inactive in Paycor",
  "unmapped-role": "role not CNA/Nurse",
  "unmapped-facility": "location didn't match a facility",
};

export function PaycorPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const res = await fetch("/api/integrations/paycor/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadStatus();
  }, []);

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/paycor/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(data.error || "Sync failed");
      } else {
        setResult(data);
        router.refresh();
      }
      loadStatus();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Paycor</p>
          <p className="text-xs text-slate-500">Pull employees into their facilities with pay rates.</p>
        </div>
        {status && (
          <span className={`chip ${status.configured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {status.configured ? "Connected" : "Not connected"}
          </span>
        )}
      </div>

      {status && !status.configured && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Add these to your Vercel environment variables to connect:
          <ul className="mt-1 list-inside list-disc font-mono">
            {(status.missingVars.length ? status.missingVars : ["PAYCOR_CLIENT_ID", "PAYCOR_CLIENT_SECRET", "PAYCOR_SUBSCRIPTION_KEY", "PAYCOR_TENANT_ID"]).map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {status && (
        <div className="text-xs text-slate-500">
          {status.syncedEmployees} employees synced from Paycor
          {status.lastSyncAt && ` · last sync ${new Date(status.lastSyncAt).toLocaleString()}`}
        </div>
      )}

      <button className="btn-primary w-full" onClick={sync} disabled={busy || (status ? !status.configured : false)}>
        {busy ? "Syncing…" : "Sync employees from Paycor"}
      </button>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Synced {result.fetched} from Paycor — {result.created} added, {result.updated} updated
          {result.skipped > 0 && `, ${result.skipped} skipped`}.
          {result.skipped > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {Object.entries(result.skippedByReason)
                .filter(([, n]) => n > 0)
                .map(([reason, n]) => (
                  <li key={reason}>{n} — {REASON_LABEL[reason] ?? reason}</li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
