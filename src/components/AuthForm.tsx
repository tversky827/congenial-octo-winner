"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [showManagerField, setShowManagerField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

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
      // Full navigation so server components re-read the new session cookie.
      window.location.href = "/shifts";
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
              <label className="label" htmlFor="position">Your role (optional)</label>
              <input className="input" id="position" name="position" placeholder="e.g. CNA, RN, Caregiver" />
            </div>
            {showManagerField ? (
              <div>
                <label className="label" htmlFor="managerInviteCode">Manager invite code</label>
                <input className="input" id="managerInviteCode" name="managerInviteCode" placeholder="Provided by your admin" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowManagerField(true)}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                I&apos;m a manager / scheduler
              </button>
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
