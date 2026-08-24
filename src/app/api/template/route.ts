import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { templateShiftSchema } from "@/lib/validation";

// List a facility's staffing template (corporate only).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) return NextResponse.json({ error: "Corporate access required" }, { status: 403 });

  const facilityId = new URL(req.url).searchParams.get("facilityId") || "";
  const entries = await prisma.templateShift.findMany({
    where: { facilityId, active: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ entries });
}

// Add a staffing requirement (corporate only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) return NextResponse.json({ error: "Corporate access required" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = templateShiftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const facility = await prisma.facility.findUnique({ where: { id: d.facilityId } });
  if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 400 });

  const entry = await prisma.templateShift.create({
    data: {
      facilityId: d.facilityId,
      position: d.position,
      dayOfWeek: d.dayOfWeek,
      startTime: d.startTime,
      endTime: d.endTime,
      count: d.count,
      bonus: d.bonus,
    },
  });
  return NextResponse.json({ id: entry.id });
}
