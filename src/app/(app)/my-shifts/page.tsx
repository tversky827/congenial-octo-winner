import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ShiftCard, type ShiftCardData } from "@/components/ShiftCard";
import { PageHeader, EmptyState } from "@/components/Page";
import type { Shift } from "@prisma/client";

export const dynamic = "force-dynamic";

function toCardData(shift: Shift & { facility: { name: string } | null }): ShiftCardData {
  return {
    id: shift.id,
    title: shift.title,
    position: shift.position,
    facilityName: shift.facility?.name ?? null,
    location: shift.location,
    startTime: shift.startTime.toISOString(),
    endTime: shift.endTime.toISOString(),
    bonus: shift.bonus,
    notes: shift.notes,
    status: shift.status,
  };
}

export default async function MyShiftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "WORKER") redirect("/shifts");

  // Confirmed = shifts I'm assigned to (by the scheduler or via an approved claim),
  // but only once the week is live. Waiting = my pending marketplace claims.
  const [confirmed, pending] = await Promise.all([
    prisma.shift.findMany({
      where: {
        assignedToId: user.id,
        status: { in: ["ASSIGNED", "FILLED"] },
        OR: [{ schedule: { published: true } }, { scheduleId: null }],
      },
      include: { facility: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.claim.findMany({
      where: { workerId: user.id, status: "PENDING" },
      include: { shift: { include: { facility: { select: { name: true } } } } },
      orderBy: { shift: { startTime: "asc" } },
    }),
  ]);

  const nothing = confirmed.length === 0 && pending.length === 0;

  return (
    <div>
      <PageHeader title="My shifts" subtitle="Shifts you're scheduled for or have claimed." />

      {nothing ? (
        <EmptyState
          emoji="🗓️"
          title="Nothing scheduled yet"
          body="When your manager schedules you — or you claim an open shift — it shows here."
        />
      ) : (
        <div className="space-y-6">
          {confirmed.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Confirmed ({confirmed.length})
              </h2>
              <div className="space-y-3">
                {confirmed.map((s) => (
                  <ShiftCard key={s.id} shift={toCardData(s)} viewerRole="WORKER" viewerRate={user.baseRate} myClaimStatus="APPROVED" showActions={false} />
                ))}
              </div>
            </section>
          )}
          {pending.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Waiting for approval ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((c) => (
                  <ShiftCard key={c.id} shift={toCardData(c.shift)} viewerRole="WORKER" viewerRate={user.baseRate} myClaimStatus="PENDING" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
