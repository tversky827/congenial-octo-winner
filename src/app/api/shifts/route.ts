import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isManager } from "@/lib/auth";
import { createShiftSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isManager(user)) {
    return NextResponse.json({ error: "Only managers can post shifts" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createShiftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const shift = await prisma.shift.create({
    data: {
      title: d.title,
      position: d.position,
      location: d.location,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      hourlyRate: d.hourlyRate,
      differential: d.differential,
      breakMinutes: d.breakMinutes,
      overtimeAfterHours: d.overtimeAfterHours,
      overtimeMultiplier: d.overtimeMultiplier,
      notes: d.notes || null,
      postedById: user.id,
    },
  });

  return NextResponse.json({ id: shift.id });
}
