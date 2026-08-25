// Smart alerts / insights engine. Turns raw signals (coverage gaps, expiring
// credentials, overtime risk, unpublished schedules) into a prioritized,
// human-readable feed. Pure factories + ranking so it's fully unit-testable;
// the data layer supplies the numbers.

export type InsightSeverity = "critical" | "warning" | "info";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  link?: string;
}

const RANK: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function rankInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

// --- Pure factories: each returns an Insight or null when there's nothing to say.

export function coverageGapInsight(args: {
  facilityName: string;
  understaffed: number; // red positions (plan short)
  toFill: number;       // amber positions (built, unfilled)
  dayLabel: string;
  link?: string;
}): Insight | null {
  const { facilityName, understaffed, toFill, dayLabel, link } = args;
  if (understaffed === 0 && toFill === 0) return null;
  const severity: InsightSeverity = understaffed > 0 ? "critical" : "warning";
  const parts: string[] = [];
  if (understaffed > 0) parts.push(`${understaffed} understaffed`);
  if (toFill > 0) parts.push(`${toFill} to fill`);
  return {
    id: `coverage:${facilityName}:${dayLabel}`,
    severity,
    title: `${facilityName}: coverage gap ${dayLabel}`,
    detail: `${parts.join(", ")} — assign staff or send to the marketplace.`,
    link,
  };
}

export function credentialInsight(args: {
  expired: number;
  expiring: number;
  link?: string;
}): Insight | null {
  const { expired, expiring, link } = args;
  if (expired === 0 && expiring === 0) return null;
  const severity: InsightSeverity = expired > 0 ? "critical" : "warning";
  const parts: string[] = [];
  if (expired > 0) parts.push(`${expired} expired`);
  if (expiring > 0) parts.push(`${expiring} expiring soon`);
  return {
    id: "credentials",
    severity,
    title: "Credentials need attention",
    detail: `${parts.join(", ")}. Staff with expired credentials can't claim licensed shifts.`,
    link,
  };
}

export function overtimeInsight(args: { count: number; link?: string }): Insight | null {
  if (args.count === 0) return null;
  return {
    id: "overtime",
    severity: "warning",
    title: "Overtime risk",
    detail: `${args.count} ${args.count === 1 ? "person is" : "people are"} at or past 40h this week.`,
    link: args.link,
  };
}

export function unpublishedInsight(args: { facilityName: string; link?: string }): Insight {
  return {
    id: `unpublished:${args.facilityName}`,
    severity: "info",
    title: `${args.facilityName}: schedule not published`,
    detail: "Unassigned shifts won't reach the marketplace until you publish.",
    link: args.link,
  };
}

export const SEVERITY_META: Record<InsightSeverity, { dot: string; tone: string }> = {
  critical: { dot: "🔴", tone: "bg-red-50 text-red-700 ring-red-100" },
  warning: { dot: "🟡", tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  info: { dot: "🔵", tone: "bg-brand-50 text-brand-700 ring-brand-100" },
};
