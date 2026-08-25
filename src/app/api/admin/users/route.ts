import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { orgWhere } from "@/lib/tenant";

// List everyone with their facility + role (corporate only, own org).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: orgWhere(user),
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      active: true,
      facility: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ users });
}
