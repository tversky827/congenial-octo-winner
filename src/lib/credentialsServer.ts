import { prisma } from "./db";
import { hasValidCredential, complianceSummary, type ComplianceSummary } from "./credentials";

/**
 * The credential type a position requires, if any. Looked up by the org +
 * position name that shifts carry (denormalized).
 */
export async function requiredCredentialFor(
  organizationId: string | null,
  positionName: string
): Promise<string | null> {
  if (!organizationId) return null;
  const position = await prisma.position.findFirst({
    where: { organizationId, name: positionName, active: true },
    select: { requiredCredential: true },
  });
  const req = position?.requiredCredential?.trim();
  return req ? req : null;
}

/**
 * Whether a worker satisfies the credential a position requires. Returns
 * `undefined` when the position requires nothing (so the eligibility check is
 * skipped), or a boolean when a requirement exists.
 */
export async function credentialSatisfied(
  workerId: string,
  organizationId: string | null,
  positionName: string,
  now = new Date()
): Promise<boolean | undefined> {
  const required = await requiredCredentialFor(organizationId, positionName);
  if (!required) return undefined;
  const creds = await prisma.credential.findMany({
    where: { workerId, active: true },
    select: { type: true, expiresAt: true, active: true },
  });
  return hasValidCredential(creds, required, now);
}

/** Compliance summary for a worker (for the people list / profile). */
export async function workerCompliance(workerId: string, now = new Date()): Promise<ComplianceSummary> {
  const creds = await prisma.credential.findMany({
    where: { workerId, active: true },
    select: { type: true, expiresAt: true, active: true },
  });
  return complianceSummary(creds, now);
}
