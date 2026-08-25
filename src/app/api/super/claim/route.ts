import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Bootstrap the platform operator. A corporate admin who supplies the correct
// platform code (env SUPER_ADMIN_CODE) is promoted to SUPER_ADMIN. This is the
// vendor-side account; it's intentionally gated by a shared secret rather than
// exposed in the UI role picker.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required first" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const code = process.env.SUPER_ADMIN_CODE || "platform-owner";
  if (!body?.code || body.code !== code) {
    return NextResponse.json({ error: "Invalid platform code" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "user.claim_super_admin", entityType: "User", entityId: user.id,
    before: { role: user.role }, after: { role: updated.role },
  });
  return NextResponse.json({ ok: true });
}
