import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRelativeTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/Page";
import { MarkAllRead } from "@/components/MarkAllRead";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = (await getCurrentUser())!;

  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hasUnread = items.some((i) => !i.read);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your shifts and claims."
        action={<MarkAllRead hasUnread={hasUnread} />}
      />

      {items.length === 0 ? (
        <EmptyState emoji="🔔" title="No notifications yet" body="You'll hear from us when there's news about your shifts." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const content = (
              <div className={`card flex gap-3 ${n.read ? "" : "ring-2 ring-brand-100"}`}>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                <div className={n.read ? "pl-5" : ""}>
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link}>
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
