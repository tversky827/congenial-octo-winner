import { prisma } from "./db";

interface AuditArgs {
  actorId?: string | null;
  actorName?: string | null;
  organizationId?: string | null;
  action: string; // e.g. "schedule.publish", "shift.assign", "user.role_change"
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Append an immutable audit record. Audit logging must NEVER break the action it
 * records, so this swallows its own errors.
 */
export async function audit(args: AuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: args.actorId ?? null,
        actorName: args.actorName ?? null,
        organizationId: args.organizationId ?? null,
        action: args.action,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        before: args.before !== undefined ? JSON.stringify(args.before) : null,
        after: args.after !== undefined ? JSON.stringify(args.after) : null,
        ip: args.ip ?? null,
      },
    });
  } catch {
    /* never throw from the audit path */
  }
}
