import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { facilityCreateSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

// List active facilities. Public so the sign-up screen can populate its dropdown;
// only non-sensitive fields (id, name) are returned.
export async function GET() {
  const facilities = await prisma.facility.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ facilities });
}

// Create a facility (corporate only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Only corporate admins can add facilities" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = facilityCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const facility = await prisma.facility.create({
    data: {
      name: parsed.data.name,
      address: parsed.data.address || null,
      organizationId: user.organizationId,
    },
  });
  await audit({
    actorId: user.id,
    actorName: user.name,
    organizationId: user.organizationId,
    action: "facility.create",
    entityType: "Facility",
    entityId: facility.id,
    after: { name: facility.name },
  });
  return NextResponse.json({ id: facility.id, name: facility.name });
}
