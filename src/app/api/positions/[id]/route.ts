import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";

// Retire a position (corporate only, own org). Soft-deactivate so historical
// shifts/employees that reference the name are unaffected.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  const position = await prisma.position.findUnique({ where: { id: params.id } });
  if (!position) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sameOrg(user, position.organizationId)) {
    return NextResponse.json({ error: "Out of your scope" }, { status: 403 });
  }
  await prisma.position.update({ where: { id: position.id }, data: { active: false } });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "position.retire", entityType: "Position", entityId: position.id, before: { name: position.name },
  });
  return NextResponse.json({ ok: true });
}
