import { prisma } from "./db";
import { credentialState } from "./credentials";
import { sendEmail, renderNotificationEmail, appUrl } from "./email";
import { sendSms, renderNotificationSms } from "./sms";

async function alertNurse(userId: string, title: string, body: string, link: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, notifyEmail: true, notifySms: true, mustSetPassword: true },
  });
  if (!u || u.mustSetPassword) return;
  if (u.email && u.notifyEmail) {
    await sendEmail({ to: u.email, ...renderNotificationEmail(title, body, link) }).catch(() => {});
  }
  if (u.phone && u.notifySms) {
    await sendSms({ to: u.phone, body: renderNotificationSms(title, body, link, appUrl()) }).catch(() => {});
  }
}

const DAY = 86_400_000;

/**
 * Create "credential/license expiring (or expired)" notifications for pool
 * nurses, de-duped so a run every day doesn't spam: we skip a nurse if they
 * already have a matching alert from the last `cooldownDays`.
 */
export async function scanExpiringForOrg(
  organizationId: string,
  now = new Date(),
  warnDays = 30,
  cooldownDays = 14
): Promise<number> {
  const horizon = new Date(now.getTime() + warnDays * DAY);
  const cooldownSince = new Date(now.getTime() - cooldownDays * DAY);
  let created = 0;

  // Licenses on the nurse record.
  const nurses = await prisma.user.findMany({
    where: { organizationId, poolMember: true, active: true, licenseExpiry: { not: null, lte: horizon } },
    select: { id: true, licenseType: true, licenseExpiry: true },
  });

  for (const n of nurses) {
    const state = credentialState(n.licenseExpiry, now);
    if (state !== "expiring" && state !== "expired") continue;
    const recent = await prisma.notification.findFirst({
      where: { userId: n.id, title: { contains: "License" }, createdAt: { gte: cooldownSince } },
      select: { id: true },
    });
    if (recent) continue;
    const when = n.licenseExpiry!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    const title = state === "expired" ? "License expired" : "License expiring soon";
    const body = `Your ${n.licenseType ?? "license"} ${state === "expired" ? "expired" : "expires"} ${when}. Update it to keep claiming shifts.`;
    await prisma.notification.create({ data: { userId: n.id, title, body, link: "/pool" } });
    await alertNurse(n.id, title, body, "/pool");
    created++;
  }

  // Tracked credentials (BLS/CPR, TB, etc.) for pool nurses.
  const creds = await prisma.credential.findMany({
    where: { active: true, expiresAt: { not: null, lte: horizon }, worker: { organizationId, poolMember: true, active: true } },
    select: { id: true, type: true, expiresAt: true, workerId: true },
  });
  for (const c of creds) {
    const state = credentialState(c.expiresAt, now);
    if (state !== "expiring" && state !== "expired") continue;
    const recent = await prisma.notification.findFirst({
      where: { userId: c.workerId, title: { contains: c.type }, createdAt: { gte: cooldownSince } },
      select: { id: true },
    });
    if (recent) continue;
    const when = c.expiresAt!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    const title = `${c.type} ${state === "expired" ? "expired" : "expiring"}`;
    const body = `Your ${c.type} ${state === "expired" ? "expired" : "expires"} ${when}.`;
    await prisma.notification.create({ data: { userId: c.workerId, title, body, link: "/pool" } });
    await alertNurse(c.workerId, title, body, "/pool");
    created++;
  }

  return created;
}

export async function scanExpiringAllOrgs(now = new Date()): Promise<number> {
  const orgs = await prisma.organization.findMany({ where: { active: true }, select: { id: true } });
  let total = 0;
  for (const o of orgs) total += await scanExpiringForOrg(o.id, now);
  return total;
}
