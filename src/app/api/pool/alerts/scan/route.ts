import { NextResponse } from "next/server";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { scanExpiringForOrg, scanExpiringAllOrgs } from "@/lib/credentialAlerts";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Scheduled scan (Vercel Cron, CRON_SECRET-gated) → all orgs.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const created = await scanExpiringAllOrgs();
  return NextResponse.json({ ok: true, created });
}

// Manual run for a corporate admin's own org (handy for testing / on demand).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user) || !user.organizationId) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  const created = await scanExpiringForOrg(user.organizationId);
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "alerts.credential_scan", entityType: "Organization", entityId: user.organizationId,
    after: { created },
  });
  return NextResponse.json({ ok: true, created });
}
