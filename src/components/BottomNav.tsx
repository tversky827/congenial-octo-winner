"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string; icon: JSX.Element; badge?: boolean };

function Icon({ path }: { path: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  shifts: "M4 7h16M4 12h16M4 17h10",
  schedule: "M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 8h.01M12 14h.01M16 14h.01",
  post: "M12 5v14M5 12h14",
  mine: "M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
  approvals: "M9 12l2 2 4-4m-7 8h6a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4Z",
  admin: "M4 20V9l8-5 8 5v11M4 20h16M9 20v-6h6v6M9 9h.01M15 9h.01",
  alerts: "M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9",
};

export function BottomNav({ role }: { role: "CORPORATE" | "MANAGER" | "WORKER" }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setUnread(data.unread ?? 0);
      } catch {
        /* ignore transient errors */
      }
    }
    poll();
    const id = setInterval(poll, 20000);
    // Refresh when the tab regains focus.
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  let items: Item[];
  if (role === "CORPORATE") {
    items = [
      { href: "/schedule", label: "Schedule", icon: <Icon path={ICONS.schedule} /> },
      { href: "/manage", label: "Approvals", icon: <Icon path={ICONS.approvals} /> },
      { href: "/admin/facilities", label: "Admin", icon: <Icon path={ICONS.admin} /> },
      { href: "/notifications", label: "Alerts", icon: <Icon path={ICONS.alerts} />, badge: true },
    ];
  } else if (role === "MANAGER") {
    items = [
      { href: "/schedule", label: "Schedule", icon: <Icon path={ICONS.schedule} /> },
      { href: "/manage", label: "Approvals", icon: <Icon path={ICONS.approvals} /> },
      { href: "/notifications", label: "Alerts", icon: <Icon path={ICONS.alerts} />, badge: true },
    ];
  } else {
    items = [
      { href: "/shifts", label: "Shifts", icon: <Icon path={ICONS.shifts} /> },
      { href: "/my-shifts", label: "My Shifts", icon: <Icon path={ICONS.mine} /> },
      { href: "/notifications", label: "Alerts", icon: <Icon path={ICONS.alerts} />, badge: true },
    ];
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map((item) => {
          const matchPrefix = item.href.startsWith("/admin") ? "/admin" : item.href;
          const active =
            item.href === "/shifts"
              ? pathname === "/shifts"
              : pathname === item.href || pathname.startsWith(matchPrefix);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                active ? "text-brand-600" : "text-slate-400"
              }`}
            >
              <span className="relative">
                {item.icon}
                {item.badge && unread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
