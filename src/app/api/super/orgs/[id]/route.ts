import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Activate / deactivate an organization (super-admin only).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Platform access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { active: body.active },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: org.id,
    action: body.active ? "org.activate" : "org.deactivate", entityType: "Organization", entityId: org.id,
    before: { active: org.active }, after: { active: updated.active },
  });
  return NextResponse.json({ ok: true, active: updated.active });
}
