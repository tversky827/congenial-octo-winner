import { describe, it, expect } from "vitest";
import { overlaps, hasOverlap, violatesRest, exceedsMaxWeeklyHours, seatAvailable, scheduledHours } from "@/lib/poolRules";

const r = (s: string, e: string) => ({ start: new Date(s), end: new Date(e) });

describe("overlaps", () => {
  it("detects overlap and treats touching as non-overlap", () => {
    expect(overlaps(r("2026-10-15T07:00Z", "2026-10-15T15:00Z"), r("2026-10-15T13:00Z", "2026-10-15T21:00Z"))).toBe(true);
    expect(overlaps(r("2026-10-15T07:00Z", "2026-10-15T15:00Z"), r("2026-10-15T15:00Z", "2026-10-15T23:00Z"))).toBe(false);
  });
});

describe("violatesRest", () => {
  const candidate = r("2026-10-15T16:00Z", "2026-10-16T00:00Z"); // 4p–12a
  it("flags too little rest after a prior shift", () => {
    // prior ends 3p, candidate starts 4p → 1h rest < 8h
    expect(violatesRest(candidate, [r("2026-10-15T07:00Z", "2026-10-15T15:00Z")], 8)).toBe(true);
  });
  it("passes with enough rest", () => {
    // prior ends 2a, candidate starts 4p → 14h rest
    expect(violatesRest(candidate, [r("2026-10-15T00:00Z", "2026-10-15T02:00Z")], 8)).toBe(false);
  });
  it("is disabled when minRest is 0", () => {
    expect(violatesRest(candidate, [r("2026-10-15T07:00Z", "2026-10-15T15:00Z")], 0)).toBe(false);
  });
});

describe("exceedsMaxWeeklyHours", () => {
  it("blocks past the cap", () => {
    expect(exceedsMaxWeeklyHours(56, 8, 60)).toBe(true);
    expect(exceedsMaxWeeklyHours(48, 8, 60)).toBe(false);
  });
});

describe("seatAvailable", () => {
  it("is true while seats remain", () => {
    expect(seatAvailable(1, 2)).toBe(true);
    expect(seatAvailable(2, 2)).toBe(false);
  });
});

describe("scheduledHours", () => {
  it("subtracts the unpaid break", () => {
    expect(scheduledHours(new Date("2026-10-15T07:00Z"), new Date("2026-10-15T15:00Z"))).toBe(8);
    expect(scheduledHours(new Date("2026-10-15T07:00Z"), new Date("2026-10-15T15:00Z"), 30)).toBe(7.5);
  });
});

describe("hasOverlap", () => {
  it("checks against a list", () => {
    const c = r("2026-10-15T07:00Z", "2026-10-15T15:00Z");
    expect(hasOverlap(c, [r("2026-10-16T07:00Z", "2026-10-16T15:00Z")])).toBe(false);
    expect(hasOverlap(c, [r("2026-10-15T14:00Z", "2026-10-15T22:00Z")])).toBe(true);
  });
});
