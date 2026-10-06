"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/facility", label: "Dashboard", exact: true },
  { href: "/facility/approvals", label: "Approvals" },
  { href: "/facility/post", label: "Post shift" },
  { href: "/facility/cost", label: "Cost" },
];

export function FacilityTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-semibold">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center transition ${
              active ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
