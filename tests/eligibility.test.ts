import { describe, it, expect } from "vitest";
import { checkEligibility, rangesOverlap } from "@/lib/eligibility";

const shift = {
  status: "OPEN",
  facilityId: "fac1",
  position: "CNA",
  startTime: new Date("2026-09-01T13:00:00Z"),
  endTime: new Date("2026-09-01T21:00:00Z"),
};
const worker = { active: true, facilityId: "fac1", position: "CNA" };

describe("rangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(
      rangesOverlap(
        { startTime: new Date("2026-09-01T12:00:00Z"), endTime: new Date("2026-09-01T14:00:00Z") },
        { startTime: new Date("2026-09-01T13:00:00Z"), endTime: new Date("2026-09-01T21:00:00Z") }
      )
    ).toBe(true);
  });
  it("treats touching ranges (end == start) as non-overlapping", () => {
    expect(
      rangesOverlap(
        { startTime: new Date("2026-09-01T05:00:00Z"), endTime: new Date("2026-09-01T13:00:00Z") },
        { startTime: new Date("2026-09-01T13:00:00Z"), endTime: new Date("2026-09-01T21:00:00Z") }
      )
    ).toBe(false);
  });
});

describe("checkEligibility", () => {
  it("passes a matching, active worker with no conflicts", () => {
    expect(checkEligibility(worker, shift, []).eligible).toBe(true);
  });
  it("rejects an inactive worker", () => {
    expect(checkEligibility({ ...worker, active: false }, shift).reason).toBe("INACTIVE");
  });
  it("rejects a different facility", () => {
    expect(checkEligibility({ ...worker, facilityId: "other" }, shift).reason).toBe("WRONG_FACILITY");
  });
  it("rejects a different role", () => {
    expect(checkEligibility({ ...worker, position: "Nurse" }, shift).reason).toBe("WRONG_ROLE");
  });
  it("rejects a shift that isn't open", () => {
    expect(checkEligibility(worker, { ...shift, status: "FILLED" }).reason).toBe("NOT_OPEN");
  });
  it("rejects an overlapping commitment", () => {
    const conflict = { startTime: new Date("2026-09-01T14:00:00Z"), endTime: new Date("2026-09-01T22:00:00Z") };
    expect(checkEligibility(worker, shift, [conflict]).reason).toBe("OVERLAP");
  });
  it("allows a non-overlapping commitment", () => {
    const other = { startTime: new Date("2026-09-02T13:00:00Z"), endTime: new Date("2026-09-02T21:00:00Z") };
    expect(checkEligibility(worker, shift, [other]).eligible).toBe(true);
  });
});
