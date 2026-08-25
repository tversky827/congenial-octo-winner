// Budgeted daily coverage per facility, used to seed each facility's staffing
// template ("the shifts we need every day"). Columns from the source grid map to
// shift windows:
//   AM   → 06:00–14:00   PM   → 14:00–22:00
//   6-10 → 18:00–22:00   NOC  → 22:00–06:00
// A "-" or 0 in the grid means no shift in that bucket (omitted below).

export const SHIFT_WINDOWS = {
  AM: { startTime: "06:00", endTime: "14:00", label: "AM" },
  PM: { startTime: "14:00", endTime: "22:00", label: "PM" },
  MID: { startTime: "18:00", endTime: "22:00", label: "6–10" },
  NOC: { startTime: "22:00", endTime: "06:00", label: "NOC" },
} as const;

export type ShiftBucket = keyof typeof SHIFT_WINDOWS;
type Buckets = Partial<Record<ShiftBucket, number>>;

export interface FacilityBudget {
  facility: string;
  CNA: Buckets;
  Nurse: Buckets;
}

export const DEFAULT_FACILITY_BUDGET: FacilityBudget[] = [
  { facility: "Bloomington",   CNA: { AM: 8, MID: 1, NOC: 4 },        Nurse: { AM: 3, MID: 1, NOC: 2 } },
  { facility: "Danville",      CNA: { AM: 8, MID: 1, NOC: 5 },        Nurse: { AM: 3, MID: 1, NOC: 2 } },
  { facility: "Gibson",        CNA: { AM: 5, PM: 6, NOC: 3 },         Nurse: { AM: 2, PM: 2, NOC: 1 } },
  { facility: "Pontiac",       CNA: { AM: 8, MID: 3, NOC: 4 },        Nurse: { AM: 3, NOC: 3 } },
  { facility: "Marseilles",    CNA: { AM: 5, NOC: 4 },                Nurse: { AM: 2, NOC: 2 } },
  { facility: "Spring Valley", CNA: { AM: 7, PM: 7, NOC: 4 },         Nurse: { AM: 3, MID: 1, NOC: 2 } },
  { facility: "Toluca",        CNA: { AM: 6, PM: 6, NOC: 3 },         Nurse: { AM: 3, NOC: 2 } },
  { facility: "Princeton",     CNA: { AM: 7, PM: 6, NOC: 4 },         Nurse: { AM: 3, MID: 1, NOC: 2 } },
  { facility: "Peoria",        CNA: { AM: 5, MID: 2, NOC: 3 },        Nurse: { AM: 3, NOC: 2 } },
  { facility: "Roseville",     CNA: { AM: 4, NOC: 3 },                Nurse: { AM: 2, NOC: 2 } },
  { facility: "Clinton",       CNA: { AM: 10, MID: 4, NOC: 6 },       Nurse: { AM: 4, MID: 1, NOC: 3 } },
];

export interface CoverageRow {
  position: string;
  startTime: string;
  endTime: string;
  count: number;
}

const BUCKET_ORDER: ShiftBucket[] = ["AM", "PM", "MID", "NOC"];

/** Expand one facility's budget into template rows (only buckets with count > 0). */
export function budgetToRows(b: FacilityBudget): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const position of ["CNA", "Nurse"] as const) {
    const buckets = b[position];
    for (const key of BUCKET_ORDER) {
      const count = buckets[key];
      if (count && count > 0) {
        const w = SHIFT_WINDOWS[key];
        rows.push({ position, startTime: w.startTime, endTime: w.endTime, count });
      }
    }
  }
  return rows;
}

/** URL/id-friendly handle for a facility name. */
export function facilitySlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
