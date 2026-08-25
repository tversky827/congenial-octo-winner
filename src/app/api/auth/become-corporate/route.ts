import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";
}

// One-time bootstrap: lets a signed-in user claim corporate access using the
// management code — but only while no corporate admin exists yet. This solves
// the chicken-and-egg where the first account was created as a worker/scheduler.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const existingCorporate = await prisma.user.count({ where: { role: "CORPORATE" } });
  if (existingCorporate > 0) {
    return NextResponse.json(
      { error: "Corporate access is already set up. Ask an existing corporate admin." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const code = (body?.managementCode ?? "").toString().trim();
  if (!code || code !== process.env.MANAGER_INVITE_CODE) {
    return NextResponse.json({ error: "Invalid management code" }, { status: 400 });
  }

  // Ensure an Organization exists for this tenant, then fold in any existing
  // data that isn't yet assigned to one (backfills the live single tenant).
  let org = await prisma.organization.findFirst();
  if (!org) {
    const orgName = process.env.NEXT_PUBLIC_APP_NAME || "My Organization";
    org = await prisma.organization.create({
      data: { name: orgName, slug: `${slugify(orgName)}-${Date.now().toString(36)}` },
    });
    await prisma.$transaction([
      prisma.facility.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
      prisma.user.updateMany({ where: { organizationId: null }, data: { organizationId: org.id } }),
    ]);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "CORPORATE", facilityId: null, organizationId: org.id },
  });

  await audit({
    actorId: updated.id,
    actorName: updated.name,
    organizationId: org.id,
    action: "user.claim_corporate",
    entityType: "User",
    entityId: updated.id,
    after: { role: "CORPORATE", organizationId: org.id },
  });

  // Refresh the session so the new role takes effect immediately.
  await createSession(updated);
  return NextResponse.json({ ok: true });
}
