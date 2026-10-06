import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { nursePreferencesSchema } from "@/lib/validation";

// A pool nurse sets their shift-matching preferences (what they get alerted about).
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.poolMember) return NextResponse.json({ error: "Pool nurses only" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = nursePreferencesSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const p = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(p.minRate !== undefined ? { prefMinRate: p.minRate } : {}),
      ...(p.facilityIds !== undefined ? { prefFacilityIds: JSON.stringify(p.facilityIds) } : {}),
      ...(p.daysOfWeek !== undefined ? { prefDaysOfWeek: JSON.stringify(p.daysOfWeek) } : {}),
      ...(p.notifyEmail !== undefined ? { notifyEmail: p.notifyEmail } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
