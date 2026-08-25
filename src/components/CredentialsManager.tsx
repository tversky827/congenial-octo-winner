"use client";

import { useEffect, useState } from "react";
import { credentialState, CREDENTIAL_STATE_META } from "@/lib/credentials";

interface Credential {
  id: string;
  type: string;
  number: string | null;
  expiresAt: string | null;
}

// Corporate-facing credential list + add/remove for one worker. Loads lazily
// when the profile is expanded.
export function CredentialsManager({ workerId }: { workerId: string }) {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "", number: "", expiresAt: "" });

  async function load() {
    try {
      const res = await fetch(`/api/credentials?workerId=${workerId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCreds(data.credentials ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add");
        return;
      }
      setForm({ type: "", number: "", expiresAt: "" });
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/credentials/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();

  return (
    <div className="col-span-2 rounded-xl bg-white p-3 ring-1 ring-slate-100">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Credentials</p>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : creds.length === 0 ? (
        <p className="text-xs text-slate-400">None on file.</p>
      ) : (
        <div className="space-y-1">
          {creds.map((c) => {
            const state = credentialState(c.expiresAt ? new Date(c.expiresAt) : null, now);
            const meta = CREDENTIAL_STATE_META[state];
            return (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {c.type}
                  {c.expiresAt && (
                    <span className="text-slate-400">
                      {" "}· exp {new Date(c.expiresAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
                    </span>
                  )}
                  <span className={`chip ml-2 ${meta.tone}`}>{meta.label}</span>
                </span>
                <button className="text-xs text-slate-400 hover:text-red-600" disabled={busy} onClick={() => remove(c.id)}>
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={add} className="mt-2 grid grid-cols-2 gap-2">
        <input className="input py-2 text-sm" placeholder="Type (e.g. RN License)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required disabled={busy} />
        <input className="input py-2 text-sm" placeholder="Number (optional)" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} disabled={busy} />
        <div className="col-span-2 flex gap-2">
          <input className="input py-2 text-sm" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} disabled={busy} aria-label="Expiry date" />
          <button className="btn-primary px-4 text-sm" disabled={busy}>Add</button>
        </div>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
