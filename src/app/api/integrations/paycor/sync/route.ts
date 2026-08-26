import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { ensureOrganizationForUser } from "@/lib/org";
import { paycorConfigured } from "@/lib/paycor";
import { runPaycorSync } from "@/lib/paycorRun";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual sync — a corporate admin pulls their org's employees from Paycor.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  if (!paycorConfigured()) {
    return NextResponse.json({ error: "Paycor isn't connected yet. Add the Paycor credentials in the environment settings." }, { status: 400 });
  }

  const organizationId = await ensureOrganizationForUser(user);
  const summary = await runPaycorSync(organizationId, { id: user.id, name: user.name });
  const status = summary.ok ? 200 : 502;
  return NextResponse.json(summary, { status });
}

// Scheduled sync — triggered by Vercel Cron. Protected by CRON_SECRET (sent as
// `Authorization: Bearer <secret>`). Syncs every organization.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!paycorConfigured()) {
    return NextResponse.json({ error: "Paycor not configured" }, { status: 400 });
  }

  const orgs = await prisma.organization.findMany({ where: { active: true }, select: { id: true } });
  const results = [];
  for (const org of orgs) {
    results.push({ organizationId: org.id, ...(await runPaycorSync(org.id, { id: "cron", name: "Scheduled sync" })) });
  }
  return NextResponse.json({ ok: true, organizations: results.length, results });
}
