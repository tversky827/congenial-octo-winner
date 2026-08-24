"use client";

import { useState } from "react";

export function BecomeCorporate() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/become-corporate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managementCode: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not complete setup");
        setBusy(false);
        return;
      }
      window.location.href = "/admin/facilities";
    } catch {
      setError("Network error — please try again");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div>
        <label className="label" htmlFor="code">Management code</label>
        <input
          className="input"
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter your management code"
          autoFocus
        />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Setting up…" : "Become corporate admin"}
      </button>
    </form>
  );
}
