import { prisma } from "./db";
import { audit } from "./audit";
import { getPoolRules } from "./poolSettings";
import { credentialState } from "./credentials";
import { hasOverlap, violatesRest, exceedsMaxWeeklyHours, scheduledHours, type TimeRange } from "./poolRules";
import { weekStartOf } from "./week";

export type ClaimReason =
  | "NOT_POOL_NURSE"
  | "INACTIVE"
  | "NOT_OPEN"
  | "SHIFT_FULL"
  | "NOT_ELIGIBLE_FACILITY"
  | "ORIENTATION_INCOMPLETE"
  | "LICENSE_EXPIRED"
  | "WRONG_LICENSE"
  | "OVERLAP"
  | "REST_VIOLATION"
  | "MAX_HOURS"
  | "ALREADY_CLAIMED";

export const CLAIM_MESSAGE: Record<ClaimReason, string> = {
  NOT_POOL_NURSE: "Only pool nurses can claim pool shifts.",
  INACTIVE: "Your account is inactive — contact an administrator.",
  NOT_OPEN: "This shift is no longer open.",
  SHIFT_FULL: "This shift is already fully staffed.",
  NOT_ELIGIBLE_FACILITY: "You're not approved to work at this facility.",
  ORIENTATION_INCOMPLETE: "Finish this facility's orientation before claiming shifts there.",
  LICENSE_EXPIRED: "Your license has expired — update it to claim shifts.",
  WRONG_LICENSE: "This shift requires a different license.",
  OVERLAP: "You're already booked for an overlapping shift.",
  REST_VIOLATION: "This shift doesn't leave the required rest between shifts.",
  MAX_HOURS: "Claiming this would exceed your weekly hours limit.",
  ALREADY_CLAIMED: "You've already claimed this shift.",
};

export class ClaimError extends Error {
  constructor(public reason: ClaimReason) {
    super(CLAIM_MESSAGE[reason]);
  }
}

const OPEN_STATUSES = ["OPEN", "PARTIALLY_FILLED"];

/**
 * A pool nurse claims one seat of a shift. Eligibility is enforced here (never
 * the UI): pool membership, facility eligibility + orientation, license
 * validity/type, no overlap, rest period, and weekly-hours cap. The seat is
 * taken with an atomic conditional increment inside a transaction, so two nurses
 * can take two seats but never the same last seat, and overlap is re-checked
 * transactionally to prevent a double-book race.
 */
export async function claimPoolShift(nurseId: string, shiftId: string) {
  const [nurse, shift] = await Promise.all([
    prisma.user.findUnique({ where: { id: nurseId } }),
    prisma.shift.findUnique({ where: { id: shiftId }, include: { facility: { select: { id: true, name: true } } } }),
  ]);
  if (!nurse || !nurse.active) throw new ClaimError("INACTIVE");
  if (!nurse.poolMember) throw new ClaimError("NOT_POOL_NURSE");
  if (!shift || !shift.facilityId) throw new ClaimError("NOT_OPEN");
  if (shift.status === "FILLED" || shift.seatsFilled >= shift.nursesNeeded) throw new ClaimError("SHIFT_FULL");
  if (!OPEN_STATUSES.includes(shift.status)) throw new ClaimError("NOT_OPEN");

  // Facility eligibility + orientation.
  const elig = await prisma.nurseFacilityEligibility.findUnique({
    where: { nurseId_facilityId: { nurseId, facilityId: shift.facilityId } },
  });
  if (!elig || !elig.active) throw new ClaimError("NOT_ELIGIBLE_FACILITY");
  if (!elig.orientationComplete) throw new ClaimError("ORIENTATION_INCOMPLETE");

  // License type + expiry.
  if (shift.requiredLicense && nurse.licenseType && shift.requiredLicense !== nurse.licenseType) {
    throw new ClaimError("WRONG_LICENSE");
  }
  if (nurse.licenseExpiry && credentialState(nurse.licenseExpiry, new Date()) === "expired") {
    throw new ClaimError("LICENSE_EXPIRED");
  }

  const rules = await getPoolRules(nurse.organizationId);
  const candidate: TimeRange = { start: shift.startTime, end: shift.endTime };
  const hours = scheduledHours(shift.startTime, shift.endTime, shift.breakMinutes);

  // Existing (non-cancelled) assignments for overlap/rest, and this week's hours.
  const existing = await prisma.shiftAssignment.findMany({
    where: { nurseId, status: { notIn: ["CANCELLED"] } },
    select: { scheduledStart: true, scheduledEnd: true, scheduledHours: true },
  });
  const commitments: TimeRange[] = existing.map((e) => ({ start: e.scheduledStart, end: e.scheduledEnd }));
  if (hasOverlap(candidate, commitments)) throw new ClaimError("OVERLAP");
  if (violatesRest(candidate, commitments, rules.minRestHours)) throw new ClaimError("REST_VIOLATION");

  const weekStart = weekStartOf(shift.startTime);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const weekHours = existing
    .filter((e) => e.scheduledStart >= weekStart && e.scheduledStart < weekEnd)
    .reduce((sum, e) => sum + e.scheduledHours, 0);
  if (exceedsMaxWeeklyHours(weekHours, hours, rules.maxHoursPerWeek)) throw new ClaimError("MAX_HOURS");

  // Atomic seat claim + transactional overlap re-check.
  const assignment = await prisma.$transaction(async (tx) => {
    const seat = await tx.shift.updateMany({
      where: { id: shiftId, status: { in: OPEN_STATUSES }, seatsFilled: { lt: shift.nursesNeeded } },
      data: { seatsFilled: { increment: 1 } },
    });
    if (seat.count === 0) throw new ClaimError("SHIFT_FULL");

    // Re-check overlap inside the transaction (defends against a concurrent claim).
    const conflict = await tx.shiftAssignment.findFirst({
      where: {
        nurseId,
        status: { notIn: ["CANCELLED"] },
        scheduledStart: { lt: shift.endTime },
        scheduledEnd: { gt: shift.startTime },
      },
      select: { id: true },
    });
    if (conflict) throw new ClaimError("OVERLAP");

    let created;
    try {
      created = await tx.shiftAssignment.create({
        data: {
          shiftId,
          nurseId,
          facilityId: shift.facilityId!,
          scheduledStart: shift.startTime,
          scheduledEnd: shift.endTime,
          scheduledHours: hours,
          payRate: nurse.baseRate,
          differentialPerHour: shift.differentialPerHour,
          status: "CLAIMED",
        },
      });
    } catch (e) {
      // Unique (shiftId, nurseId) → already claimed; rollback releases the seat.
      throw new ClaimError("ALREADY_CLAIMED");
    }

    const fresh = await tx.shift.findUnique({ where: { id: shiftId }, select: { seatsFilled: true, nursesNeeded: true } });
    const nowStatus = (fresh?.seatsFilled ?? 0) >= (fresh?.nursesNeeded ?? 1) ? "FILLED" : "PARTIALLY_FILLED";
    await tx.shift.update({
      where: { id: shiftId },
      data: { status: nowStatus, ...(shift.nursesNeeded === 1 ? { assignedToId: nurseId } : {}) },
    });

    return created;
  });

  await audit({
    actorId: nurseId, actorName: nurse.name, organizationId: nurse.organizationId,
    action: "pool.claim", entityType: "ShiftAssignment", entityId: assignment.id,
    after: { shiftId, facilityId: shift.facilityId, hours },
  });

  return assignment;
}
