import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";

// One-time bootstrap: lets a signed-in user claim corporate access using the
// management code — but only while no corporate admin exists yet. This solves
// the chicken-and-egg where the first account was created as a worker/scheduler.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const existingCorporate = await prisma.user.count({ where: { role: "CORPORATE" } });
  if (existingCorporate > 0) {
    return NextResponse.json(
      { error: "Corporate access is already set up. Ask an existing corporate admin." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const code = (body?.managementCode ?? "").toString().trim();
  if (!code || code !== process.env.MANAGER_INVITE_CODE) {
    return NextResponse.json({ error: "Invalid management code" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "CORPORATE", facilityId: null },
  });
  // Refresh the session so the new role takes effect immediately.
  await createSession(updated);
  return NextResponse.json({ ok: true });
}
