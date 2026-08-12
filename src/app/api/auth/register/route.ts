import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { name, email, password, position, managerInviteCode } = parsed.data;

  // Decide role: a valid invite code makes this a MANAGER account.
  let role: "MANAGER" | "WORKER" = "WORKER";
  if (managerInviteCode && managerInviteCode.trim().length > 0) {
    if (managerInviteCode.trim() !== process.env.MANAGER_INVITE_CODE) {
      return NextResponse.json({ error: "Invalid manager invite code" }, { status: 400 });
    }
    role = "MANAGER";
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      position: position || null,
      role,
    },
  });

  await createSession(user);
  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
