import type { User } from "@prisma/client";

// Facility visibility rules, in one place so every screen and API scopes the
// same way:
//   - CORPORATE sees all facilities (optionally filtered to one they pick).
//   - MANAGER / WORKER see only the facility they belong to.

/** Prisma `where` fragment (on a model that has `facilityId`) for what this user may see. */
export function facilityScopeWhere(
  user: Pick<User, "role" | "facilityId">,
  selectedFacilityId?: string | null
): { facilityId?: string } {
  if (user.role === "CORPORATE") {
    return selectedFacilityId ? { facilityId: selectedFacilityId } : {};
  }
  // A non-corporate user with no facility can see nothing (shouldn't happen once
  // set up, but fail closed rather than exposing every facility).
  return { facilityId: user.facilityId ?? "__no_facility__" };
}

/** Can this user act on / see things in the given facility? */
export function canAccessFacility(
  user: Pick<User, "role" | "facilityId">,
  facilityId: string | null | undefined
): boolean {
  if (user.role === "CORPORATE") return true;
  return !!facilityId && user.facilityId === facilityId;
}
