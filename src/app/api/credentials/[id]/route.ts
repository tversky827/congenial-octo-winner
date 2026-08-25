import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";

// Remove a credential (soft-deactivate). Corporate only.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const credential = await prisma.credential.findUnique({
    where: { id: params.id },
    include: { worker: { select: { organizationId: true } } },
  });
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sameOrg(user, credential.worker.organizationId)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await prisma.credential.update({ where: { id: credential.id }, data: { active: false } });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "credential.remove", entityType: "Credential", entityId: credential.id,
    before: { type: credential.type },
  });
  return NextResponse.json({ ok: true });
}
