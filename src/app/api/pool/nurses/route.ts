import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate, hashPassword } from "@/lib/auth";
import { ensureOrganizationForUser } from "@/lib/org";
import { audit } from "@/lib/audit";
import { poolNurseCreateSchema } from "@/lib/validation";

function parseExpiry(raw: string | undefined): Date | null | undefined {
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return isNaN(d.getTime()) ? undefined : d;
}

// Create a pool nurse — or convert an existing user (e.g. a Paycor import) into
// one. Pool nurses have no employer facility; eligibility is set separately.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = poolNurseCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, licenseType, licenseNumber, baseRate } = parsed.data;
  const licenseExpiry = parseExpiry(parsed.data.licenseExpiry || undefined);
  if (licenseExpiry === undefined) {
    return NextResponse.json({ error: "Invalid license expiry date" }, { status: 400 });
  }

  const organizationId = await ensureOrganizationForUser(user);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Convert an existing account into a pool nurse.
    if (existing.organizationId && existing.organizationId !== organizationId) {
      return NextResponse.json({ error: "That person is in a different organization" }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "POOL_NURSE", poolMember: true, facilityId: null,
        licenseType, licenseNumber: licenseNumber || null, licenseExpiry,
        baseRate, organizationId, active: true,
      },
    });
    await audit({
      actorId: user.id, actorName: user.name, organizationId,
      action: "pool.nurse_convert", entityType: "User", entityId: updated.id,
      after: { email, licenseType, baseRate },
    });
    return NextResponse.json({ id: updated.id, converted: true });
  }

  const nurse = await prisma.user.create({
    data: {
      name, email, role: "POOL_NURSE", organizationId,
      poolMember: true, facilityId: null, position: "Nurse",
      licenseType, licenseNumber: licenseNumber || null, licenseExpiry, baseRate,
      mustSetPassword: true,
      passwordHash: await hashPassword(`pool-${Date.now()}-${Math.random()}`),
    },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId,
    action: "pool.nurse_create", entityType: "User", entityId: nurse.id,
    after: { email, licenseType, baseRate },
  });
  return NextResponse.json({ id: nurse.id });
}
