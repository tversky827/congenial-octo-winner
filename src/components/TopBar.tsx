"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TopBar({ name, role }: { name: string; role: "MANAGER" | "WORKER" }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = name.split(" ")[0];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 3h6a1 1 0 0 1 1 1v1h1.5A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5H8V4a1 1 0 0 1 1-1Z" fill="white" />
            <path d="m8.5 13 2 2 4-4" stroke="#236b59" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Hi, {firstName}</p>
          <p className="text-xs text-slate-500">{role === "MANAGER" ? "Scheduler" : "Team member"}</p>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100"
          aria-label="Account menu"
        >
          {firstName.charAt(0).toUpperCase()}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
              <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">{name}</div>
              <button
                onClick={logout}
                className="w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
