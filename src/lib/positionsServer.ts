import { prisma } from "./db";
import { DEFAULT_POSITIONS } from "./positions";

// Server-side helpers for the organization's configurable positions.
// Position names are stored (denormalized) on shifts/employees; these validate
// and list them against the org's configured Position records.

export async function orgPositionNames(organizationId: string | null): Promise<string[]> {
  if (!organizationId) return []; // transitional tenants (null org) have none yet
  const rows = await prisma.position.findMany({
    where: { organizationId, active: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

/**
 * Is `name` a valid position for this org? If the org hasn't configured any
 * positions yet, we allow anything (backward-compatible during migration).
 */
export async function isAllowedPosition(organizationId: string | null, name: string): Promise<boolean> {
  const names = await orgPositionNames(organizationId);
  if (names.length === 0) return true;
  return names.includes(name);
}

/** Org's configured position names, or the fallback list if none configured. */
export async function orgPositionNamesOrDefault(organizationId: string | null): Promise<string[]> {
  const names = await orgPositionNames(organizationId);
  return names.length ? names : [...DEFAULT_POSITIONS];
}
