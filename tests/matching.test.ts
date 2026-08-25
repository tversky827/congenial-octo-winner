import { describe, it, expect } from "vitest";
import { scoreCandidate, rankCandidates } from "@/lib/matching";

const ctx = { shiftMinutes: 8 * 60 }; // an 8h shift

describe("scoreCandidate", () => {
  it("rewards reliability and available hours", () => {
    const s = scoreCandidate(
      { id: "a", name: "A", reliabilityScore: 100, weeklyMinutes: 0, baseRate: 20 },
      ctx
    );
    expect(s.projectedHours).toBe(8);
    expect(s.wouldOvertime).toBe(false);
    expect(s.score).toBeGreaterThan(70);
    expect(s.reasons).toContain("Highly reliable");
  });

  it("flags and penalizes a candidate who would hit overtime", () => {
    const s = scoreCandidate(
      { id: "b", name: "B", reliabilityScore: 100, weeklyMinutes: 36 * 60, baseRate: 20 },
      ctx
    );
    expect(s.projectedHours).toBe(44);
    expect(s.wouldOvertime).toBe(true);
    expect(s.reasons.some((r) => r.includes("overtime"))).toBe(true);
  });

  it("treats a new worker as neutral, not zero", () => {
    const s = scoreCandidate(
      { id: "c", name: "C", reliabilityScore: null, weeklyMinutes: 0, baseRate: 20 },
      ctx
    );
    expect(s.reasons).toContain("New — no attendance history yet");
    expect(s.score).toBeGreaterThan(0);
  });
});

describe("rankCandidates", () => {
  it("ranks the reliable, rested worker above the overtime risk", () => {
    const ranked = rankCandidates(
      [
        { id: "tired", name: "Tired", reliabilityScore: 100, weeklyMinutes: 38 * 60, baseRate: 20 },
        { id: "fresh", name: "Fresh", reliabilityScore: 95, weeklyMinutes: 8 * 60, baseRate: 20 },
      ],
      ctx
    );
    expect(ranked[0].id).toBe("fresh");
    expect(ranked[1].id).toBe("tired");
  });

  it("breaks ties by fewer weekly hours", () => {
    const ranked = rankCandidates(
      [
        { id: "more", name: "More", reliabilityScore: 90, weeklyMinutes: 20 * 60, baseRate: 20 },
        { id: "less", name: "Less", reliabilityScore: 90, weeklyMinutes: 10 * 60, baseRate: 20 },
      ],
      ctx
    );
    expect(ranked[0].id).toBe("less");
  });
});
