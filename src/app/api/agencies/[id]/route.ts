import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";

// Retire an agency partner (soft-deactivate). Corporate only.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const agency = await prisma.agency.findUnique({ where: { id: params.id } });
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sameOrg(user, agency.organizationId)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await prisma.agency.update({ where: { id: agency.id }, data: { active: false } });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "agency.retire", entityType: "Agency", entityId: agency.id, before: { name: agency.name },
  });
  return NextResponse.json({ ok: true });
}
