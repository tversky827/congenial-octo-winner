// Marketplace eligibility engine.
//
// Whether a given employee may claim a given shift. Kept as a pure function of
// plain data so it can be unit-tested and reused by both the board (to explain
// why a shift is unavailable) and the claim/approval routes (to enforce it —
// the UI never decides eligibility on its own).

export type IneligibleReason =
  | "INACTIVE"
  | "WRONG_FACILITY"
  | "WRONG_ROLE"
  | "NOT_OPEN"
  | "OVERLAP"
  | "MISSING_CREDENTIAL";

export interface EligibilityWorker {
  active: boolean;
  facilityId: string | null;
  position: string | null;
}

export interface EligibilityShift {
  status: string;
  facilityId: string | null;
  position: string;
  startTime: Date;
  endTime: Date;
}

/** An existing commitment the worker already has (assigned shift or approved claim). */
export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

export const INELIGIBLE_MESSAGE: Record<IneligibleReason, string> = {
  INACTIVE: "Your account is inactive — ask your scheduler.",
  WRONG_FACILITY: "That shift is at a different facility.",
  WRONG_ROLE: "That shift is for a different role.",
  NOT_OPEN: "This shift is no longer open.",
  OVERLAP: "You're already booked for an overlapping shift.",
  MISSING_CREDENTIAL: "You're missing a valid credential required for this role.",
};

/** Two ranges overlap when each starts before the other ends. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startTime.getTime() < b.endTime.getTime() && b.startTime.getTime() < a.endTime.getTime();
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: IneligibleReason;
  message?: string;
}

export interface EligibilityOptions {
  commitments?: TimeRange[];
  // When the position requires a credential, whether the worker holds a valid
  // one. Undefined means "no credential required" (skip the check).
  credentialSatisfied?: boolean;
}

/**
 * Evaluate eligibility. `commitments` is every other shift the worker is already
 * on (assigned or approved) — used to reject a double-booking. Pass the shift's
 * own id excluded from that list. `credentialSatisfied` gates licensed roles.
 */
export function checkEligibility(
  worker: EligibilityWorker,
  shift: EligibilityShift,
  optionsOrCommitments: EligibilityOptions | TimeRange[] = {}
): EligibilityResult {
  // Back-compat: a bare array is treated as commitments.
  const options: EligibilityOptions = Array.isArray(optionsOrCommitments)
    ? { commitments: optionsOrCommitments }
    : optionsOrCommitments;
  const commitments = options.commitments ?? [];

  const fail = (reason: IneligibleReason): EligibilityResult => ({
    eligible: false,
    reason,
    message: INELIGIBLE_MESSAGE[reason],
  });

  if (!worker.active) return fail("INACTIVE");
  if (!worker.facilityId || worker.facilityId !== shift.facilityId) return fail("WRONG_FACILITY");
  if (!worker.position || worker.position !== shift.position) return fail("WRONG_ROLE");
  if (shift.status !== "OPEN") return fail("NOT_OPEN");
  if (commitments.some((c) => rangesOverlap(c, shift))) return fail("OVERLAP");
  if (options.credentialSatisfied === false) return fail("MISSING_CREDENTIAL");

  return { eligible: true };
}
