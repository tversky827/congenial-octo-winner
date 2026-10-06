import { prisma } from "./db";

interface NotifyArgs {
  userId: string;
  title: string;
  body: string;
  link?: string;
}

/** Create an in-app notification for a single user. */
export async function notify({ userId, title, body, link }: NotifyArgs): Promise<void> {
  await prisma.notification.create({
    data: { userId, title, body, link },
  });
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
