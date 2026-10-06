import { describe, it, expect } from "vitest";
import { matchesPreferences, parsePreferences } from "@/lib/shiftMatch";

const shift = { facilityId: "f1", effectiveRate: 40, dayOfWeek: 3 };

describe("matchesPreferences", () => {
  it("matches when no preferences are set", () => {
    expect(matchesPreferences(shift, { minRate: null, facilityIds: null, daysOfWeek: null })).toBe(true);
    expect(matchesPreferences(shift, { minRate: null, facilityIds: [], daysOfWeek: [] })).toBe(true);
  });

  it("filters by minimum rate", () => {
    expect(matchesPreferences(shift, { minRate: 38, facilityIds: null, daysOfWeek: null })).toBe(true);
    expect(matchesPreferences(shift, { minRate: 42, facilityIds: null, daysOfWeek: null })).toBe(false);
  });

  it("filters by preferred facility", () => {
    expect(matchesPreferences(shift, { minRate: null, facilityIds: ["f1", "f2"], daysOfWeek: null })).toBe(true);
    expect(matchesPreferences(shift, { minRate: null, facilityIds: ["f2"], daysOfWeek: null })).toBe(false);
  });

  it("filters by preferred day of week", () => {
    expect(matchesPreferences(shift, { minRate: null, facilityIds: null, daysOfWeek: [3, 4] })).toBe(true);
    expect(matchesPreferences(shift, { minRate: null, facilityIds: null, daysOfWeek: [1, 2] })).toBe(false);
  });

  it("requires all set criteria", () => {
    expect(matchesPreferences(shift, { minRate: 38, facilityIds: ["f1"], daysOfWeek: [3] })).toBe(true);
    expect(matchesPreferences(shift, { minRate: 38, facilityIds: ["f1"], daysOfWeek: [1] })).toBe(false);
  });
});

describe("parsePreferences", () => {
  it("parses JSON columns and tolerates junk", () => {
    const p = parsePreferences({ prefMinRate: 40, prefFacilityIds: '["f1","f2"]', prefDaysOfWeek: "[1,2,3]" });
    expect(p).toEqual({ minRate: 40, facilityIds: ["f1", "f2"], daysOfWeek: [1, 2, 3] });
    const empty = parsePreferences({ prefMinRate: null, prefFacilityIds: null, prefDaysOfWeek: "not json" });
    expect(empty).toEqual({ minRate: null, facilityIds: null, daysOfWeek: null });
  });
});
