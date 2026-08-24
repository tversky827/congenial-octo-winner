"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Corporate-only facility switcher. Updates the ?facility= query param, which the
// server page reads to scope what's shown.
export function FacilityFilter({ facilities }: { facilities: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("facility") ?? "";

  return (
    <select
      className="input max-w-[12rem] py-2 text-sm"
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        const qs = value ? `?facility=${value}` : "";
        router.push(`${pathname}${qs}`);
      }}
      aria-label="Filter by facility"
    >
      <option value="">All facilities</option>
      {facilities.map((f) => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  );
}
