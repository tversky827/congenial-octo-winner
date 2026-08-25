// Attendance reliability scoring. Pure so it's unit-testable and reused by the
// people list, worker profiles, and (later) the AI scheduler's ranking.

export interface AttendanceCounts {
  completed: number; // shifts clocked out
  noShows: number;   // assigned, past, never clocked in, not called off
  callOffs: number;  // recorded call-offs
  lates: number;     // clocked in past the grace window
}

export type ReliabilityTier = "new" | "excellent" | "good" | "fair" | "at-risk";

export interface Reliability {
  score: number | null; // 0–100, or null when there's no history yet
  tier: ReliabilityTier;
  counts: AttendanceCounts;
}

// Call-offs count against reliability, but only half as much as a no-show —
// calling off ahead of time is far better than simply not showing.
const NO_SHOW_WEIGHT = 1;
const CALL_OFF_WEIGHT = 0.5;

export function reliabilityScore(counts: AttendanceCounts): number | null {
  const { completed, noShows, callOffs } = counts;
  const penalty = noShows * NO_SHOW_WEIGHT + callOffs * CALL_OFF_WEIGHT;
  const opportunities = completed + penalty;
  if (opportunities <= 0) return null; // no history to judge
  return Math.round((100 * completed) / opportunities);
}

export function reliabilityTier(score: number | null): ReliabilityTier {
  if (score === null) return "new";
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "at-risk";
}

export function assessReliability(counts: AttendanceCounts): Reliability {
  const score = reliabilityScore(counts);
  return { score, tier: reliabilityTier(score), counts };
}

export const TIER_META: Record<ReliabilityTier, { label: string; tone: string }> = {
  new: { label: "New", tone: "bg-slate-100 text-slate-600" },
  excellent: { label: "Excellent", tone: "bg-emerald-50 text-emerald-700" },
  good: { label: "Good", tone: "bg-brand-50 text-brand-700" },
  fair: { label: "Fair", tone: "bg-amber-50 text-amber-700" },
  "at-risk": { label: "At risk", tone: "bg-red-50 text-red-700" },
};
