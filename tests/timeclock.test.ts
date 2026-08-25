import { describe, it, expect } from "vitest";
import { workedMinutes, actualPay, punchTiming } from "@/lib/timeclock";

describe("workedMinutes", () => {
  it("returns whole minutes between punches", () => {
    expect(workedMinutes(new Date("2026-09-01T13:00:00Z"), new Date("2026-09-01T21:30:00Z"))).toBe(510);
  });
  it("floors partial minutes", () => {
    expect(workedMinutes(new Date("2026-09-01T13:00:00Z"), new Date("2026-09-01T13:01:59Z"))).toBe(1);
  });
  it("is never negative", () => {
    expect(workedMinutes(new Date("2026-09-01T21:00:00Z"), new Date("2026-09-01T13:00:00Z"))).toBe(0);
  });
});

describe("actualPay", () => {
  it("pays hours × rate plus a bonus, rounded to cents", () => {
    expect(actualPay(510, 22)).toBe(187); // 8.5h × 22
    expect(actualPay(480, 22, 50)).toBe(226); // 8h × 22 + 50
  });
  it("handles partial hours", () => {
    expect(actualPay(90, 20)).toBe(30); // 1.5h × 20
  });
});

describe("punchTiming", () => {
  const start = new Date("2026-09-01T13:00:00Z");
  it("is on-time within the grace window", () => {
    expect(punchTiming(start, new Date("2026-09-01T13:03:00Z"))).toBe("on-time");
  });
  it("is late past the grace window", () => {
    expect(punchTiming(start, new Date("2026-09-01T13:20:00Z"))).toBe("late");
  });
  it("is early well before start", () => {
    expect(punchTiming(start, new Date("2026-09-01T12:30:00Z"))).toBe("early");
  });
});
