// Credential / compliance engine. Pure so it's unit-testable and reused by the
// people list, the compliance view, and the eligibility engine.

export const EXPIRING_SOON_DAYS = 30;

export type CredentialState = "valid" | "expiring" | "expired" | "no-expiry";

export interface CredentialLike {
  type: string;
  expiresAt: Date | null;
  active: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** State of a single credential relative to `now`. */
export function credentialState(
  expiresAt: Date | null,
  now: Date,
  warnDays = EXPIRING_SOON_DAYS
): CredentialState {
  if (!expiresAt) return "no-expiry";
  const diffDays = (expiresAt.getTime() - now.getTime()) / DAY_MS;
  if (diffDays < 0) return "expired";
  if (diffDays <= warnDays) return "expiring";
  return "valid";
}

/** Does the worker hold a currently-valid credential of `requiredType`? */
export function hasValidCredential(
  credentials: CredentialLike[],
  requiredType: string,
  now: Date
): boolean {
  return credentials.some(
    (c) =>
      c.active &&
      c.type.toLowerCase() === requiredType.toLowerCase() &&
      credentialState(c.expiresAt, now) !== "expired"
  );
}

export interface ComplianceSummary {
  total: number;
  expired: number;
  expiring: number;
  compliant: boolean; // no expired credentials
}

/** Roll a worker's credentials into a compliance summary. */
export function complianceSummary(credentials: CredentialLike[], now: Date): ComplianceSummary {
  let expired = 0;
  let expiring = 0;
  for (const c of credentials) {
    if (!c.active) continue;
    const state = credentialState(c.expiresAt, now);
    if (state === "expired") expired++;
    else if (state === "expiring") expiring++;
  }
  return {
    total: credentials.filter((c) => c.active).length,
    expired,
    expiring,
    compliant: expired === 0,
  };
}

export const CREDENTIAL_STATE_META: Record<CredentialState, { label: string; tone: string }> = {
  valid: { label: "Valid", tone: "bg-emerald-50 text-emerald-700" },
  expiring: { label: "Expiring soon", tone: "bg-amber-50 text-amber-700" },
  expired: { label: "Expired", tone: "bg-red-50 text-red-700" },
  "no-expiry": { label: "No expiry", tone: "bg-slate-100 text-slate-600" },
};
