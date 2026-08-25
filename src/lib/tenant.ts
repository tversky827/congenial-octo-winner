import type { User } from "@prisma/client";
import { normalizeRole } from "./rbac";

// Tenant isolation. Every org-scoped query passes one of these filters so a
// caller can only ever touch their own organization's data — enforced in the
// database query, not the UI.
//
// During the additive migration, records may have a null organizationId; a
// caller whose org is also null matches them (a consistent transitional tenant),
// so the live app keeps working until data is backfilled.

type Scoped = Pick<User, "organizationId" | "role">;

function isSuper(user: Scoped): boolean {
  return normalizeRole(user.role) === "SUPER_ADMIN";
}

/** Filter for models that have `organizationId` directly (Facility, User, AuditLog). */
export function orgWhere(user: Scoped): { organizationId?: string | null } {
  if (isSuper(user)) return {};
  return { organizationId: user.organizationId ?? null };
}

/** Filter for models scoped via their facility (Shift, Schedule, TemplateShift). */
export function orgViaFacilityWhere(
  user: Scoped
): { facility?: { organizationId: string | null } } {
  if (isSuper(user)) return {};
  return { facility: { organizationId: user.organizationId ?? null } };
}

/** Guard: may this user act within the given organization? */
export function sameOrg(user: Scoped, organizationId: string | null | undefined): boolean {
  if (isSuper(user)) return true;
  return (user.organizationId ?? null) === (organizationId ?? null);
}
