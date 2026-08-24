// Week helpers for the scheduling model. Weeks run Monday–Sunday and are keyed
// by their Monday at 00:00 UTC, so a week is stable regardless of server timezone.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStartOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  return new Date(d.getTime() - dow * DAY_MS);
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * DAY_MS);
}

/** The 7 day-start dates (Mon…Sun) of a week. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Absolute UTC datetime for a template entry within a given week.
 * dayOffset: 0 = Monday … 6 = Sunday. time: "HH:MM".
 * If end <= start it's treated as an overnight shift (caller adds a day).
 */
export function combineDayTime(weekStart: Date, dayOffset: number, time: string): Date {
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  return new Date(weekStart.getTime() + dayOffset * DAY_MS + (hh * 60 + mm) * 60 * 1000);
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LABELS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${weekStart.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

/** Parse a "YYYY-MM-DD" (a Monday) into a UTC week-start Date. */
export function parseWeekStart(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map((n) => parseInt(n, 10));
    return weekStartOf(new Date(Date.UTC(y, m - 1, d)));
  }
  return weekStartOf(new Date());
}

/** "YYYY-MM-DD" key for a week-start (used in URLs). */
export function weekKey(weekStart: Date): string {
  return weekStart.toISOString().slice(0, 10);
}
