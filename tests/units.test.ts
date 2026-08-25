import { describe, it, expect } from "vitest";
import { computePay } from "@/lib/pay";
import { weekStartOf, combineDayTime } from "@/lib/week";
import { orgWhere, sameOrg } from "@/lib/tenant";

describe("pay engine", () => {
  it("pay = rate × hours + bonus, no overtime", () => {
    const p = computePay({
      startTime: "2026-08-26T13:00:00.000Z",
      endTime: "2026-08-26T21:00:00.000Z", // 8h
      hourlyRate: 22,
      bonus: 50,
    });
    expect(p.hours).toBe(8);
    expect(p.basePay).toBe(176);
    expect(p.total).toBe(226);
  });

  it("a 12h shift still has no overtime multiplier", () => {
    const p = computePay({
      startTime: "2026-08-26T07:00:00.000Z",
      endTime: "2026-08-26T19:00:00.000Z",
      hourlyRate: 20,
    });
    expect(p.hours).toBe(12);
    expect(p.total).toBe(240); // 12 × 20, not time-and-a-half
  });
});

describe("week math", () => {
  it("snaps any day to that week's Monday (UTC)", () => {
    // 2026-08-26 is a Wednesday → Monday is 2026-08-24
    const ws = weekStartOf(new Date("2026-08-26T10:00:00Z"));
    expect(ws.toISOString().slice(0, 10)).toBe("2026-08-24");
  });
  it("builds a day/time within a week and handles overnight", () => {
    const ws = weekStartOf(new Date("2026-08-24T00:00:00Z"));
    const start = combineDayTime(ws, 0, "19:00"); // Mon 19:00
    expect(start.toISOString()).toContain("2026-08-24T19:00");
  });
});

describe("tenant scoping helpers", () => {
  it("scopes non-super users to their org and lets super admins see all", () => {
    expect(orgWhere({ role: "CORPORATE", organizationId: "org1" })).toEqual({ organizationId: "org1" });
    expect(orgWhere({ role: "SUPER_ADMIN", organizationId: "org1" })).toEqual({});
    expect(orgWhere({ role: "CORPORATE", organizationId: null })).toEqual({ organizationId: null });
  });
  it("sameOrg blocks cross-org and allows within-org / super", () => {
    expect(sameOrg({ role: "CORPORATE", organizationId: "a" }, "a")).toBe(true);
    expect(sameOrg({ role: "CORPORATE", organizationId: "a" }, "b")).toBe(false);
    expect(sameOrg({ role: "SUPER_ADMIN", organizationId: "a" }, "b")).toBe(true);
  });
});
