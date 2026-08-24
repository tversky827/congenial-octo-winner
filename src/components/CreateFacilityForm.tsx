"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateFacilityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add facility");
        return;
      }
      setName("");
      setAddress("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="text-sm font-semibold text-slate-900">Add a facility</p>
      <div>
        <label className="label" htmlFor="fname">Facility name</label>
        <input className="input" id="fname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise House" />
      </div>
      <div>
        <label className="label" htmlFor="faddr">Address (optional)</label>
        <input className="input" id="faddr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="120 Elm St" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Adding…" : "Add facility"}
      </button>
    </form>
  );
}
