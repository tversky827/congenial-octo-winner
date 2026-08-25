"use client";

import Link from "next/link";
import { useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  CORPORATE: "Corporate",
  MANAGER: "Scheduler",
  WORKER: "Team member",
};

export function TopBar({
  name,
  role,
  facilityLabel,
  superAdmin = false,
}: {
  name: string;
  role: "CORPORATE" | "MANAGER" | "WORKER";
  facilityLabel: string;
  superAdmin?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = name.split(" ")[0];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
      <Link href="/home" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon.svg" alt="Goldwater Care" className="h-9 w-9" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Hi, {firstName}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABEL[role] ?? role} · {facilityLabel}
          </p>
        </div>
      </Link>

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
              {superAdmin && (
                <Link
                  href="/super"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Platform console
                </Link>
              )}
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
