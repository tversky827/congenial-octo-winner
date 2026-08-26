import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { paycorConfigured, paycorMissingVars } from "@/lib/paycor";

export const dynamic = "force-dynamic";

// Connection status + last sync info for the admin Integrations screen.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const [syncedCount, lastSync] = await Promise.all([
    prisma.user.count({ where: { organizationId: user.organizationId ?? undefined, source: "paycor" } }),
    prisma.auditLog.findFirst({
      where: { organizationId: user.organizationId ?? undefined, action: "integration.paycor_sync" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, after: true },
    }),
  ]);

  return NextResponse.json({
    configured: paycorConfigured(),
    missingVars: paycorMissingVars(),
    syncedEmployees: syncedCount,
    lastSyncAt: lastSync?.createdAt ?? null,
    lastSync: lastSync?.after ?? null,
  });
}
