import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isCorporate } from "@/lib/auth";

// Remove a staffing requirement (corporate only).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) return NextResponse.json({ error: "Corporate access required" }, { status: 403 });

  await prisma.templateShift.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
