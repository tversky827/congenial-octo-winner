import { prisma } from "./db";
import { rankCandidates, type ScoredCandidate } from "./matching";
import { checkEligibility } from "./eligibility";
import { workerAttendance } from "./attendanceData";
import { credentialSatisfied } from "./credentialsServer";

function shiftMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/**
 * Rank the facility's eligible staff to fill one shift. Eligibility (facility,
 * role, no overlap, credential) is enforced first; only eligible workers are
 * scored. Returns best-first.
 */
export async function suggestCandidatesForShift(shiftId: string): Promise<ScoredCandidate[]> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!shift || !shift.facilityId) return [];

  const orgId = shift.facility?.organizationId ?? null;
  const mins = shiftMinutes(shift.startTime, shift.endTime);
  const weekStart = new Date(shift.startTime);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7)); // Monday
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const staff = await prisma.user.findMany({
    where: { facilityId: shift.facilityId, role: "WORKER", active: true, position: shift.position },
    select: { id: true, name: true, baseRate: true, facilityId: true, position: true, active: true },
  });

  const candidates = (
    await Promise.all(
      staff.map(async (w) => {
        // Existing commitments this worker holds (for overlap + weekly hours).
        const commitments = await prisma.shift.findMany({
          where: {
            assignedToId: w.id,
            status: { in: ["ASSIGNED", "FILLED", "COMPLETED"] },
            id: { not: shift.id },
          },
          select: { startTime: true, endTime: true },
        });

        const credOk = await credentialSatisfied(w.id, orgId, shift.position);
        // A scheduler can place staff on any unfilled shift (PLANNED or OPEN),
        // so evaluate eligibility as if the shift were claimable.
        const eligibility = checkEligibility(
          { active: w.active, facilityId: w.facilityId, position: w.position },
          { ...shift, status: "OPEN" },
          { commitments, credentialSatisfied: credOk }
        );
        if (!eligibility.eligible) return null;

        const weeklyMinutes = commitments
          .filter((c) => c.startTime >= weekStart && c.startTime < weekEnd)
          .reduce((sum, c) => sum + shiftMinutes(c.startTime, c.endTime), 0);
        const reliability = await workerAttendance(w.id);

        return {
          id: w.id,
          name: w.name,
          reliabilityScore: reliability.score,
          weeklyMinutes,
          baseRate: w.baseRate,
        };
      })
    )
  ).filter((c): c is NonNullable<typeof c> => c !== null);

  return rankCandidates(candidates, { shiftMinutes: mins });
}
