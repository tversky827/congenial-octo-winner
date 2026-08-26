import { prisma } from "./db";
import type { User } from "@prisma/client";

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";
}

/**
 * Ensure the user belongs to an organization, returning its id. If they already
 * have one, it's returned as-is. Otherwise we find-or-create the tenant org,
 * backfill any org-less facilities/users into it, and attach the user. This
 * makes org-scoped actions self-heal for accounts created before/around the
 * multi-tenant migration.
 */
export async function ensureOrganizationForUser(user: User): Promise<string> {
  if (user.organizationId) return user.organizationId;

  let org = await prisma.organization.findFirst();
  if (!org) {
    const orgName = process.env.NEXT_PUBLIC_APP_NAME || "My Organization";
    org = await prisma.organization.create({
      data: { name: orgName, slug: `${slugify(orgName)}-${Date.now().toString(36)}` },
    });
  }

  // Fold any org-less records into this tenant.
  await prisma.$transaction([
    prisma.facility.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
    prisma.user.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
  ]);

  return org.id;
}
