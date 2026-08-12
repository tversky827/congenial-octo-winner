// Display formatting helpers. Safe to use on both server and client.

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(amount: number): string {
  return currency.format(amount ?? 0);
}

export function formatRate(amount: number): string {
  return `${currency.format(amount ?? 0)}/hr`;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} hr${rounded === 1 ? "" : "s"}`;
}

export function formatDateRange(start: Date | string, end: Date | string): string {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  const day = s.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${day} · ${startTime} – ${endTime}`;
  }
  const endDay = e.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day} ${startTime} – ${endDay} ${endTime}`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(diffDay, "day");
}
