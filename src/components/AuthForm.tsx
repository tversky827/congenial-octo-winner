"use client";

import { useEffect, useState } from "react";
import { POSITIONS } from "@/lib/positions";

type Mode = "login" | "register";
type Access = "WORKER" | "MANAGER" | "CORPORATE";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [access, setAccess] = useState<Access>("WORKER");
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load facilities so employees/schedulers can pick theirs at sign-up.
  useEffect(() => {
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((d) => setFacilities(d.facilities ?? []))
      .catch(() => {});
  }, []);

  const needsFacility = access === "WORKER" || access === "MANAGER";
  const needsCode = access === "MANAGER" || access === "CORPORATE";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (mode === "register") payload.accessType = access;

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      window.location.href = data.role === "WORKER" ? "/shifts" : "/schedule";
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); }}
          className={`rounded-lg py-2 transition ${mode === "login" ? "bg-white text-brand-800" : "text-white/90"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => { setMode("register"); setError(null); }}
          className={`rounded-lg py-2 transition ${mode === "register" ? "bg-white text-brand-800" : "text-white/90"}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-3">
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input className="input" id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 8 : undefined}
            required
          />
        </div>

        {mode === "register" && (
          <>
            <div>
              <label className="label">I am a…</label>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                {([
                  ["WORKER", "Employee"],
                  ["MANAGER", "Scheduler"],
                  ["CORPORATE", "Corporate"],
                ] as [Access, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setAccess(val); setError(null); }}
                    className={`rounded-lg py-2 transition ${access === val ? "bg-brand-600 text-white" : "text-slate-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {access === "WORKER" && (
              <div>
                <label className="label" htmlFor="position">Your role</label>
                <select className="input" id="position" name="position" required defaultValue="">
                  <option value="" disabled>Choose your role…</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">You&apos;ll only see shifts for your role.</p>
              </div>
            )}

            {needsFacility && (
              <div>
                <label className="label" htmlFor="facilityId">Facility</label>
                {facilities.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No facilities yet. Ask your corporate admin to add yours, or sign up as
                    Corporate to create them.
                  </p>
                ) : (
                  <select className="input" id="facilityId" name="facilityId" required={needsFacility} defaultValue="">
                    <option value="" disabled>Choose your facility…</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {needsCode && (
              <div>
                <label className="label" htmlFor="managementCode">Management code</label>
                <input className="input" id="managementCode" name="managementCode" placeholder="Provided by your admin" />
                <p className="mt-1 text-xs text-slate-400">
                  {access === "CORPORATE"
                    ? "Corporate accounts oversee every facility."
                    : "Schedulers post & approve shifts for their facility."}
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
