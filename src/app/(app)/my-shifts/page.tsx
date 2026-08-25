import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ShiftCard, type ShiftCardData } from "@/components/ShiftCard";
import { CallOffButton } from "@/components/CallOffButton";
import { TimeClock } from "@/components/TimeClock";
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
  const [confirmed, completed, pending] = await Promise.all([
    prisma.shift.findMany({
      where: {
        assignedToId: user.id,
        status: { in: ["ASSIGNED", "FILLED"] },
        OR: [{ schedule: { published: true } }, { scheduleId: null }],
      },
      include: { facility: { select: { name: true } }, timeEntries: { where: { workerId: user.id } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.shift.findMany({
      where: { assignedToId: user.id, status: "COMPLETED" },
      include: { facility: { select: { name: true } }, timeEntries: { where: { workerId: user.id } } },
      orderBy: { startTime: "desc" },
      take: 10,
    }),
    prisma.claim.findMany({
      where: { workerId: user.id, status: "PENDING" },
      include: { shift: { include: { facility: { select: { name: true } } } } },
      orderBy: { shift: { startTime: "asc" } },
    }),
  ]);

  // A shift can be clocked in once it's within a sensible window of its start.
  const now = Date.now();
  const CLOCK_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h before start

  const nothing = confirmed.length === 0 && completed.length === 0 && pending.length === 0;

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
                {confirmed.map((s) => {
                  const upcoming = s.startTime.getTime() > now;
                  const entry = s.timeEntries[0];
                  const clockState = entry ? (entry.clockOutAt ? "done" : "in") : "not-in";
                  // Clock in from 2h before start until the shift is done.
                  const clockable = now >= s.startTime.getTime() - CLOCK_WINDOW_MS;
                  return (
                    <div key={s.id}>
                      <ShiftCard shift={toCardData(s)} viewerRole="WORKER" viewerRate={user.baseRate} myClaimStatus="APPROVED" showActions={false} />
                      {clockable && (
                        <TimeClock
                          shiftId={s.id}
                          initialState={clockState === "in" ? "in" : "not-in"}
                          clockInAt={entry?.clockInAt.toISOString() ?? null}
                          actualMinutes={entry?.actualMinutes ?? null}
                        />
                      )}
                      {upcoming && clockState === "not-in" && <CallOffButton shiftId={s.id} />}
                    </div>
                  );
                })}
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
          {completed.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Recently worked
              </h2>
              <div className="space-y-3">
                {completed.map((s) => {
                  const entry = s.timeEntries[0];
                  const mins = entry?.actualMinutes ?? null;
                  return (
                    <div key={s.id}>
                      <ShiftCard shift={toCardData(s)} viewerRole="WORKER" viewerRate={user.baseRate} showActions={false} />
                      {mins != null && (
                        <p className="mt-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                          ✓ {Math.floor(mins / 60)}h {mins % 60}m worked
                          {entry?.actualPay != null ? ` · earned $${entry.actualPay.toFixed(2)}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
