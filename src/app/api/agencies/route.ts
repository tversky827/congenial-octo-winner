import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate, canManage } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { agencyCreateSchema } from "@/lib/validation";

// List the org's agency partners (schedulers & corporate can read — schedulers
// need them to fill shifts).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!user.organizationId) return NextResponse.json({ agencies: [] });

  const agencies = await prisma.agency.findMany({
    where: { organizationId: user.organizationId, active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ agencies });
}

// Create an agency partner (corporate only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: "Set up your organization first." }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = agencyCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.agency.findFirst({
    where: { organizationId: user.organizationId, name: parsed.data.name },
  });
  if (existing) return NextResponse.json({ error: "That agency already exists" }, { status: 409 });

  const agency = await prisma.agency.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      contactName: parsed.data.contactName || null,
      contactPhone: parsed.data.contactPhone || null,
      contactEmail: parsed.data.contactEmail || null,
      billRate: parsed.data.billRate,
    },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "agency.create", entityType: "Agency", entityId: agency.id, after: { name: agency.name, billRate: agency.billRate },
  });
  return NextResponse.json({ id: agency.id });
}
