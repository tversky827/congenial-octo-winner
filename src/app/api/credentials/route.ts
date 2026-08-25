import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { sameOrg } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { credentialCreateSchema } from "@/lib/validation";

function parseDate(raw: string | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return isNaN(d.getTime()) ? undefined : d;
}

// List credentials for a worker (?workerId=). A worker may read their own;
// corporate may read anyone in their org.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const workerId = new URL(req.url).searchParams.get("workerId") || user.id;

  if (workerId !== user.id && !isCorporate(user)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (workerId !== user.id) {
    const target = await prisma.user.findUnique({ where: { id: workerId }, select: { organizationId: true } });
    if (!target || !sameOrg(user, target.organizationId)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
  }

  const credentials = await prisma.credential.findMany({
    where: { workerId, active: true },
    orderBy: [{ expiresAt: "asc" }, { type: "asc" }],
  });
  return NextResponse.json({ credentials });
}

// Add a credential for a worker (corporate only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = credentialCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.workerId },
    select: { organizationId: true, name: true },
  });
  if (!target || !sameOrg(user, target.organizationId)) {
    return NextResponse.json({ error: "That person is in a different organization" }, { status: 403 });
  }

  const issuedAt = parseDate(parsed.data.issuedAt);
  const expiresAt = parseDate(parsed.data.expiresAt);
  if (issuedAt === undefined && parsed.data.issuedAt) {
    return NextResponse.json({ error: "Invalid issued date" }, { status: 400 });
  }
  if (expiresAt === undefined && parsed.data.expiresAt) {
    return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
  }

  const credential = await prisma.credential.create({
    data: {
      workerId: parsed.data.workerId,
      type: parsed.data.type,
      number: parsed.data.number || null,
      issuedAt: issuedAt ?? null,
      expiresAt: expiresAt ?? null,
    },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "credential.create", entityType: "Credential", entityId: credential.id,
    after: { worker: target.name, type: credential.type, expiresAt: credential.expiresAt },
  });
  return NextResponse.json({ id: credential.id });
}
