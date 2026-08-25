import { prisma } from "./db";
import type { User } from "@prisma/client";
import { orgWhere } from "./tenant";
import { weekStartOf } from "./week";
import { facilityWeekCoverage } from "./coverageData";
import { workerCompliance } from "./credentialsServer";
import { projectWeekly } from "./overtime";
import {
  rankInsights,
  coverageGapInsight,
  credentialInsight,
  overtimeInsight,
  unpublishedInsight,
  type Insight,
} from "./insights";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the prioritized insights feed for a user's scope. Corporate sees their
 * whole org; a scheduler sees their facility.
 */
export async function insightsFor(user: User): Promise<Insight[]> {
  const weekStart = weekStartOf(new Date());
  const todayKey = new Date().toISOString().slice(0, 10);
  const tomorrowKey = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);

  const corporate = !user.facilityId; // corporate/super have no single facility
  const facilities = corporate
    ? await prisma.facility.findMany({
        where: { active: true, ...orgWhere(user) },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : await prisma.facility.findMany({
        where: { id: user.facilityId ?? "__none__" },
        select: { id: true, name: true },
      });

  const insights: Insight[] = [];

  // 1. Coverage gaps today & tomorrow, per facility.
  for (const f of facilities) {
    const cov = await facilityWeekCoverage(f.id, f.name, weekStart);
    if (!cov.built) continue;

    for (const [key, label] of [[todayKey, "today"], [tomorrowKey, "tomorrow"]] as const) {
      const day = cov.days.find((d) => d.dateKey === key);
      if (!day) continue;
      const understaffed = day.lines.filter((l) => l.status === "red").length;
      const toFill = day.lines.filter((l) => l.status === "amber").length;
      const gap = coverageGapInsight({
        facilityName: f.name,
        understaffed,
        toFill,
        dayLabel: label,
        link: `/coverage?facility=${f.id}`,
      });
      if (gap) insights.push(gap);
    }

    if (cov.built && !cov.published) {
      insights.push(
        unpublishedInsight({ facilityName: f.name, link: `/schedule?facility=${f.id}` })
      );
    }
  }

  // 2. Credential compliance across the scope's staff.
  const staff = await prisma.user.findMany({
    where: {
      role: "WORKER",
      active: true,
      ...(corporate ? orgWhere(user) : { facilityId: user.facilityId ?? "__none__" }),
    },
    select: { id: true },
  });
  let expired = 0;
  let expiring = 0;
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  let otRisk = 0;
  for (const s of staff) {
    const c = await workerCompliance(s.id);
    expired += c.expired;
    expiring += c.expiring;

    // Overtime risk: assigned minutes this week.
    const shifts = await prisma.shift.findMany({
      where: {
        assignedToId: s.id,
        status: { in: ["ASSIGNED", "FILLED", "COMPLETED"] },
        startTime: { gte: weekStart, lt: weekEnd },
      },
      select: { startTime: true, endTime: true },
    });
    const minutes = shifts.reduce(
      (sum, sh) => sum + Math.max(0, Math.round((sh.endTime.getTime() - sh.startTime.getTime()) / 60000)),
      0
    );
    if (projectWeekly(minutes).flag !== "ok") otRisk++;
  }

  const cred = credentialInsight({ expired, expiring, link: "/admin/people" });
  if (cred) insights.push(cred);
  const ot = overtimeInsight({ count: otRisk, link: "/schedule" });
  if (ot) insights.push(ot);

  return rankInsights(insights);
}
