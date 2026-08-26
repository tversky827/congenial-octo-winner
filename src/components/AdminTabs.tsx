"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/facilities", label: "Facilities" },
  { href: "/admin/positions", label: "Positions" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/coverage", label: "Coverage" },
  { href: "/admin/agencies", label: "Agencies" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/integrations", label: "Integrations" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-semibold">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
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
