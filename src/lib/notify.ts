import { prisma } from "./db";
import { sendEmail, renderNotificationEmail } from "./email";
import { sendSms, renderNotificationSms } from "./sms";
import { appUrl } from "./email";

interface NotifyArgs {
  userId: string;
  title: string;
  body: string;
  link?: string;
  // Also deliver by these channels (best-effort; each respects the recipient's
  // preference). In-app is always written.
  email?: boolean;
  sms?: boolean;
}

/** Create an in-app notification for a single user, optionally email + SMS too. */
export async function notify({ userId, title, body, link, email, sms }: NotifyArgs): Promise<void> {
  await prisma.notification.create({
    data: { userId, title, body, link },
  });

  if (!email && !sms) return;

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, poolMember: true, notifyEmail: true, notifySms: true, mustSetPassword: true },
  });
  if (!u || u.mustSetPassword) return;

  // Email: real address + (for pool nurses) email opt-out honored.
  if (email && u.email && (!u.poolMember || u.notifyEmail)) {
    await sendEmail({ to: u.email, ...renderNotificationEmail(title, body, link ?? null) }).catch(() => {});
  }
  // SMS: opt-in only, needs a phone number.
  if (sms && u.phone && u.notifySms) {
    await sendSms({ to: u.phone, body: renderNotificationSms(title, body, link ?? null, appUrl()) }).catch(() => {});
  }
}

/**
 * Notify the people who can act on a facility's shift: that facility's
 * scheduler(s) plus all corporate admins. Used when a worker claims/withdraws.
 */
export async function notifyFacilityManagers(
  facilityId: string | null,
  args: Omit<NotifyArgs, "userId">
): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { role: "CORPORATE" },
        ...(facilityId ? [{ role: "MANAGER", facilityId }] : []),
      ],
    },
    select: { id: true },
  });
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((m) => ({
      userId: m.id,
      title: args.title,
      body: args.body,
      link: args.link,
    })),
  });
}

/**
 * Notify the people who approve a facility's pool hours: corporate admins
 * (all facilities) and that facility's admins/schedulers (any role flavour).
 */
export async function notifyPoolApprovers(
  facilityId: string | null,
  args: Omit<NotifyArgs, "userId">
): Promise<void> {
  const corporateRoles = ["CORPORATE", "CORPORATE_ADMIN", "SUPER_ADMIN"];
  const facilityRoles = ["MANAGER", "FACILITY_ADMIN", "SCHEDULER", "DON", "CHARGE_NURSE", "DEPT_MANAGER"];
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { role: { in: corporateRoles } },
        ...(facilityId ? [{ role: { in: facilityRoles }, facilityId }] : []),
      ],
    },
    select: { id: true },
  });
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((m) => ({ userId: m.id, title: args.title, body: args.body, link: args.link })),
  });
}
