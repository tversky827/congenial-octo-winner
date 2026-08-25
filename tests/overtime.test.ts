import { describe, it, expect } from "vitest";
import { projectWeekly, overtimeFlag, minutesToHours } from "@/lib/overtime";

describe("minutesToHours", () => {
  it("converts and rounds to 2 decimals", () => {
    expect(minutesToHours(510)).toBe(8.5);
    expect(minutesToHours(485)).toBe(8.08);
  });
});

describe("overtimeFlag", () => {
  it("flags over the threshold", () => {
    expect(overtimeFlag(41)).toBe("over");
  });
  it("flags approaching within 4h", () => {
    expect(overtimeFlag(37)).toBe("near");
    expect(overtimeFlag(40)).toBe("near");
  });
  it("is ok well under", () => {
    expect(overtimeFlag(30)).toBe("ok");
  });
});

describe("projectWeekly", () => {
  it("describes the current week with no added minutes", () => {
    const p = projectWeekly(38 * 60);
    expect(p.totalHours).toBe(38);
    expect(p.overtimeHours).toBe(0);
    expect(p.flag).toBe("near");
  });
  it("adds a shift and computes overtime past 40h", () => {
    const p = projectWeekly(36 * 60, 8 * 60); // 44h total
    expect(p.totalHours).toBe(44);
    expect(p.overtimeHours).toBe(4);
    expect(p.regularHours).toBe(40);
    expect(p.flag).toBe("over");
  });
  it("stays regular under the threshold", () => {
    const p = projectWeekly(20 * 60, 8 * 60);
    expect(p.totalHours).toBe(28);
    expect(p.overtimeHours).toBe(0);
    expect(p.flag).toBe("ok");
  });
});
