import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { poolNurseUpdateSchema } from "@/lib/validation";

function parseExpiry(raw: string | null | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return isNaN(d.getTime()) ? undefined : d;
}

// Update a pool nurse's license / rate / active / pool-membership.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = poolNurseUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
  if (!sameOrg(user, target.organizationId)) {
    return NextResponse.json({ error: "That person is in a different organization" }, { status: 403 });
  }

  const expiry = parseExpiry(parsed.data.licenseExpiry ?? undefined);
  if (parsed.data.licenseExpiry && expiry === undefined) {
    return NextResponse.json({ error: "Invalid license expiry date" }, { status: 400 });
  }
  const emptyToNull = (v: string | null | undefined) => (v === undefined ? undefined : v === "" ? null : v);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(parsed.data.licenseType !== undefined ? { licenseType: parsed.data.licenseType } : {}),
      ...(parsed.data.licenseNumber !== undefined ? { licenseNumber: emptyToNull(parsed.data.licenseNumber) } : {}),
      ...(expiry !== undefined ? { licenseExpiry: expiry } : {}),
      ...(parsed.data.baseRate !== undefined ? { baseRate: parsed.data.baseRate } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.poolMember !== undefined ? { poolMember: parsed.data.poolMember } : {}),
    },
  });

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "pool.nurse_update", entityType: "User", entityId: updated.id,
    after: { licenseType: updated.licenseType, baseRate: updated.baseRate, active: updated.active, poolMember: updated.poolMember },
  });
  return NextResponse.json({ id: updated.id });
}
