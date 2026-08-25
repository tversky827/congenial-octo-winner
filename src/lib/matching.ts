// Shift-fill recommendation engine. Given the eligible candidates for an open
// shift, score and rank them so a scheduler sees the best fit first. The scoring
// is transparent and rule-based (not a black box): every candidate carries the
// reasons behind its score, which schedulers can trust and audit.
//
// Signals, in priority order:
//   1. Reliability — proven attendance history (never over-book a no-show risk)
//   2. Overtime headroom — prefer staff who won't cross 40h; hard-penalize those who would
//   3. Fairness — mild preference for staff with fewer hours this week
//
// Pure + unit-tested.

import { OT_THRESHOLD_HOURS } from "./overtime";

export interface Candidate {
  id: string;
  name: string;
  reliabilityScore: number | null; // 0–100, or null for no history
  weeklyMinutes: number;            // already scheduled this week
  baseRate: number;
}

export interface MatchContext {
  shiftMinutes: number;
  otThresholdHours?: number;
}

export interface ScoredCandidate extends Candidate {
  score: number;
  projectedHours: number;
  wouldOvertime: boolean;
  reasons: string[];
}

const NEUTRAL_RELIABILITY = 70; // how we treat a brand-new worker

export function scoreCandidate(c: Candidate, ctx: MatchContext): ScoredCandidate {
  const threshold = ctx.otThresholdHours ?? OT_THRESHOLD_HOURS;
  const reasons: string[] = [];

  // 1. Reliability (0–50 points).
  const reliability = c.reliabilityScore ?? NEUTRAL_RELIABILITY;
  let score = reliability * 0.5;
  if (c.reliabilityScore === null) reasons.push("New — no attendance history yet");
  else if (reliability >= 90) reasons.push("Highly reliable");
  else if (reliability < 60) reasons.push("Below-average reliability");

  // 2. Overtime (headroom rewarded up to 30; crossing 40h penalized).
  const projectedHours = Math.round(((c.weeklyMinutes + ctx.shiftMinutes) / 60) * 100) / 100;
  let wouldOvertime = false;
  if (projectedHours > threshold) {
    wouldOvertime = true;
    score -= 25;
    reasons.push(`Would hit overtime (${projectedHours}h)`);
  } else {
    const headroom = threshold - projectedHours;
    score += Math.min(30, headroom * 2);
    if (headroom >= 8) reasons.push("Plenty of hours available");
    else reasons.push(`${Math.round(headroom)}h left before overtime`);
  }

  return {
    ...c,
    score: Math.round(score * 100) / 100,
    projectedHours,
    wouldOvertime,
    reasons,
  };
}

/** Rank candidates best-first. Ties break by fewer weekly hours, then name. */
export function rankCandidates(candidates: Candidate[], ctx: MatchContext): ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(c, ctx))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.weeklyMinutes - b.weeklyMinutes ||
        a.name.localeCompare(b.name)
    );
}
