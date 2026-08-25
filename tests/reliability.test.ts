import { describe, it, expect } from "vitest";
import { reliabilityScore, reliabilityTier, assessReliability } from "@/lib/reliability";

describe("reliabilityScore", () => {
  it("is null with no history", () => {
    expect(reliabilityScore({ completed: 0, noShows: 0, callOffs: 0, lates: 0 })).toBeNull();
  });
  it("is 100 for a perfect record", () => {
    expect(reliabilityScore({ completed: 10, noShows: 0, callOffs: 0, lates: 0 })).toBe(100);
  });
  it("penalizes no-shows fully", () => {
    // 8 completed, 2 no-shows → 8 / 10 = 80
    expect(reliabilityScore({ completed: 8, noShows: 2, callOffs: 0, lates: 0 })).toBe(80);
  });
  it("penalizes call-offs at half weight", () => {
    // 9 completed, 2 call-offs (weight .5 → penalty 1) → 9 / 10 = 90
    expect(reliabilityScore({ completed: 9, noShows: 0, callOffs: 2, lates: 0 })).toBe(90);
  });
  it("does not count lateness against the score directly", () => {
    expect(reliabilityScore({ completed: 5, noShows: 0, callOffs: 0, lates: 3 })).toBe(100);
  });
});

describe("reliabilityTier", () => {
  it("maps score bands to tiers", () => {
    expect(reliabilityTier(null)).toBe("new");
    expect(reliabilityTier(95)).toBe("excellent");
    expect(reliabilityTier(80)).toBe("good");
    expect(reliabilityTier(60)).toBe("fair");
    expect(reliabilityTier(40)).toBe("at-risk");
  });
});

describe("assessReliability", () => {
  it("bundles score, tier, and the counts", () => {
    const r = assessReliability({ completed: 8, noShows: 2, callOffs: 0, lates: 1 });
    expect(r.score).toBe(80);
    expect(r.tier).toBe("good");
    expect(r.counts.lates).toBe(1);
  });
});
