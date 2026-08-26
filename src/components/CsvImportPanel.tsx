"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ImportResult {
  ok: boolean;
  error?: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  skippedByReason: Record<string, number>;
}

const REASON_LABEL: Record<string, string> = {
  "no-email": "no email address",
  inactive: "inactive / terminated",
  "unmapped-role": "job title isn't CNA or Nurse",
  "unmapped-facility": "location didn't match a facility",
};

const TEMPLATE_HEADERS = "First Name,Last Name,Email,Employee Number,Location,Position,Status,Pay Rate";
const TEMPLATE_SAMPLE = "Jordan,Lee,jordan.lee@example.com,E-1001,Bloomington,CNA,Active,22.50";

export function CsvImportPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    setBusy(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/integrations/paycor/import-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError("Could not read the file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE_HEADERS}\n${TEMPLATE_SAMPLE}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Import from a file</p>
        <p className="text-xs text-slate-500">
          Upload a Paycor employee export (CSV). Same mapping as the live sync — try it now without
          API credentials.
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        Expected columns (extras are ignored): <span className="font-medium text-slate-700">First Name, Last Name,
        Email, Location, Position, Pay Rate</span>, optionally Employee Number &amp; Status.
        <button onClick={downloadTemplate} className="ml-1 font-medium text-brand-600 hover:text-brand-700">
          Download template
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      <button className="btn-primary w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? "Importing…" : "Choose CSV file"}
      </button>
      {fileName && !busy && !result && !error && (
        <p className="text-xs text-slate-400">Selected {fileName}</p>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Read {result.fetched} rows — <span className="font-semibold">{result.created} added</span>,{" "}
          {result.updated} updated{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
          {result.skipped > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {Object.entries(result.skippedByReason)
                .filter(([, n]) => n > 0)
                .map(([reason, n]) => (
                  <li key={reason}>{n} — {REASON_LABEL[reason] ?? reason}</li>
                ))}
            </ul>
          )}
          <p className="mt-1">Assign them from the Schedule tab; their pay rate is now on each shift.</p>
        </div>
      )}
    </div>
  );
}
