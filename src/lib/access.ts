import type { User } from "@prisma/client";
import { normalizeRole } from "./rbac";

// Facility visibility rules, in one place so every screen and API scopes the
// same way:
//   - Corporate / super admins see all facilities (optionally filtered to one).
//   - Everyone else (facility admins, schedulers, workers, pool-facility staff)
//     sees only the facility they belong to.

function seesAllFacilities(role: string): boolean {
  const r = normalizeRole(role);
  return r === "CORPORATE_ADMIN" || r === "SUPER_ADMIN";
}

/** Prisma `where` fragment (on a model that has `facilityId`) for what this user may see. */
export function facilityScopeWhere(
  user: Pick<User, "role" | "facilityId">,
  selectedFacilityId?: string | null
): { facilityId?: string } {
  if (seesAllFacilities(user.role)) {
    return selectedFacilityId ? { facilityId: selectedFacilityId } : {};
  }
  // A facility-scoped user with no facility can see nothing (shouldn't happen
  // once set up, but fail closed rather than exposing every facility).
  return { facilityId: user.facilityId ?? "__no_facility__" };
}

/** Can this user act on / see things in the given facility? */
export function canAccessFacility(
  user: Pick<User, "role" | "facilityId">,
  facilityId: string | null | undefined
): boolean {
  if (seesAllFacilities(user.role)) return true;
  return !!facilityId && user.facilityId === facilityId;
}
