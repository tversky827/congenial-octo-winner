import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { paycorConfig, fetchPaycorEmployees } from "./paycor";
import { normalizePaycorEmployee, buildSyncPlan, type SkipReason, type NormalizedEmployee } from "./paycorSync";
import { audit } from "./audit";

export interface SyncSummary {
  ok: boolean;
  error?: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  skippedByReason: Record<SkipReason, number>;
}

// A single random hash for placeholder passwords — imported employees can be
// scheduled immediately and set a real password by registering with their work
// email (see the register route's claim path).
async function placeholderHash(): Promise<string> {
  return bcrypt.hash(`imported-${Math.round(Date.now())}-${Math.random()}`, 10);
}

const EMPTY_REASONS: Record<SkipReason, number> = {
  "no-email": 0, inactive: 0, "unmapped-role": 0, "unmapped-facility": 0,
};

/**
 * Reconcile a set of normalized employees into one organization: create missing
 * WORKER accounts and update facility/position/rate on existing ones. Never
 * downgrades a non-worker (manager/corporate) and never overwrites a password.
 * Shared by the live Paycor sync and the CSV file import.
 */
export async function reconcileEmployees(
  organizationId: string,
  employees: NormalizedEmployee[],
  actor: { id: string; name: string },
  action = "integration.paycor_sync"
): Promise<SyncSummary> {
  const facilities = await prisma.facility.findMany({
    where: { organizationId, active: true },
    select: { id: true, name: true },
  });
  const existing = await prisma.user.findMany({
    where: { organizationId },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));

  const plan = buildSyncPlan(employees, facilities, existingEmails);

  // Creates.
  for (const p of plan.create) {
    await prisma.user.create({
      data: {
        email: p.email,
        name: p.name,
        role: "WORKER",
        organizationId,
        facilityId: p.facilityId,
        position: p.position,
        baseRate: p.baseRate,
        employeeId: p.externalId,
        source: "paycor",
        mustSetPassword: true,
        passwordHash: await placeholderHash(),
      },
    });
  }

  // Updates — only touch scheduling-relevant fields; never role or password.
  for (const p of plan.update) {
    await prisma.user.updateMany({
      where: { email: p.email, organizationId, role: "WORKER" },
      data: {
        facilityId: p.facilityId,
        position: p.position,
        baseRate: p.baseRate,
        employeeId: p.externalId,
        source: "paycor",
        active: true,
      },
    });
  }

  const skippedByReason = { ...EMPTY_REASONS };
  for (const s of plan.skipped) skippedByReason[s.reason]++;

  await audit({
    actorId: actor.id, actorName: actor.name, organizationId,
    action, entityType: "Organization", entityId: organizationId,
    after: { fetched: employees.length, created: plan.create.length, updated: plan.update.length, skipped: plan.skipped.length },
  });

  return {
    ok: true,
    fetched: employees.length,
    created: plan.create.length,
    updated: plan.update.length,
    skipped: plan.skipped.length,
    skippedByReason,
  };
}

/**
 * Pull employees from Paycor's live API and reconcile them into the org. Never
 * throws — failures come back on the summary.
 */
export async function runPaycorSync(
  organizationId: string,
  actor: { id: string; name: string }
): Promise<SyncSummary> {
  const cfg = paycorConfig();
  if (!cfg) {
    return { ok: false, error: "Paycor is not configured.", fetched: 0, created: 0, updated: 0, skipped: 0, skippedByReason: { ...EMPTY_REASONS } };
  }
  let raw;
  try {
    raw = await fetchPaycorEmployees(cfg);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Paycor fetch failed", fetched: 0, created: 0, updated: 0, skipped: 0, skippedByReason: { ...EMPTY_REASONS } };
  }
  return reconcileEmployees(organizationId, raw.map(normalizePaycorEmployee), actor, "integration.paycor_sync");
}
