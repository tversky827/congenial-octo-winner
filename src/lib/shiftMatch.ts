// Shift-matching: does an open pool shift match a nurse's preferences? Pure and
// unit-tested. Used to decide who gets a "new shift available" notification —
// never to auto-assign (§22). Absent/empty preferences mean "no restriction".

export interface NursePreferences {
  minRate: number | null;
  facilityIds: string[] | null; // null/empty = any facility
  daysOfWeek: number[] | null; // 0=Sun..6=Sat; null/empty = any day
}

export interface MatchShift {
  facilityId: string;
  effectiveRate: number; // base rate + differential the nurse would earn
  dayOfWeek: number; // 0=Sun..6=Sat (UTC)
}

export function matchesPreferences(shift: MatchShift, prefs: NursePreferences): boolean {
  if (prefs.minRate != null && shift.effectiveRate < prefs.minRate - 1e-9) return false;
  if (prefs.facilityIds && prefs.facilityIds.length > 0 && !prefs.facilityIds.includes(shift.facilityId)) return false;
  if (prefs.daysOfWeek && prefs.daysOfWeek.length > 0 && !prefs.daysOfWeek.includes(shift.dayOfWeek)) return false;
  return true;
}

/** Parse the JSON-encoded preference columns into a typed object (fail-soft). */
export function parsePreferences(raw: {
  prefMinRate: number | null;
  prefFacilityIds: string | null;
  prefDaysOfWeek: string | null;
}): NursePreferences {
  const parseArr = <T>(s: string | null): T[] | null => {
    if (!s) return null;
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? (v as T[]) : null;
    } catch {
      return null;
    }
  };
  return {
    minRate: raw.prefMinRate ?? null,
    facilityIds: parseArr<string>(raw.prefFacilityIds),
    daysOfWeek: parseArr<number>(raw.prefDaysOfWeek),
  };
}
