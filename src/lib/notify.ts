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

/** Notify every manager (used when a worker claims a shift). */
export async function notifyManagers(args: Omit<NotifyArgs, "userId">): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { role: "MANAGER", active: true },
    select: { id: true },
  });
  if (managers.length === 0) return;
  await prisma.notification.createMany({
    data: managers.map((m) => ({
      userId: m.id,
      title: args.title,
      body: args.body,
      link: args.link,
    })),
  });
}
