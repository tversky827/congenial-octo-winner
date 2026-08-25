import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { User } from "@prisma/client";
import { can, normalizeRole } from "./rbac";

// SQLite has no native enums, so role is a string on the model. This union keeps
// the rest of the app type-safe about the valid values.
//   CORPORATE — oversight across every facility
//   MANAGER   — scheduler for a single facility
//   WORKER    — staff member at a single facility
export type Role = "CORPORATE" | "MANAGER" | "WORKER";

const COOKIE_NAME = "sb_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a long random string in your .env file."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface SessionPayload {
  sub: string; // user id
  role: string;
  name: string;
}

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

/** Create the login cookie for a user. Call from a route handler / server action. */
export async function createSession(user: Pick<User, "id" | "role" | "name">): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export function clearSession(): void {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Returns the logged-in user (fresh from the DB) or null. */
export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub;
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) return null;
    return user;
  } catch {
    return null;
  }
}

// These stay for backward compatibility but now delegate to the central RBAC
// engine, so they also understand the new role set (not just the legacy strings).
export function isCorporate(user: Pick<User, "role"> | null): boolean {
  if (!user) return false;
  const r = normalizeRole(user.role);
  return r === "CORPORATE_ADMIN" || r === "SUPER_ADMIN";
}

/** Facility scheduler for a single site. */
export function isManager(user: Pick<User, "role"> | null): boolean {
  return !!user && normalizeRole(user.role) === "SCHEDULER";
}

/** Platform operator — sees and manages every organization. */
export function isSuperAdmin(user: Pick<User, "role"> | null): boolean {
  return !!user && normalizeRole(user.role) === "SUPER_ADMIN";
}

/** Anyone who can build schedules / assign staff (corporate, admins, schedulers…). */
export function canManage(user: Pick<User, "role"> | null): boolean {
  return can(user, "shift.assign") || can(user, "schedule.publish");
}
