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
    breakMinutes: shift.breakMinutes,
    hourlyRate: shift.hourlyRate,
    differential: shift.differential,
    overtimeAfterHours: shift.overtimeAfterHours,
    overtimeMultiplier: shift.overtimeMultiplier,
    notes: shift.notes,
    status: shift.status,
  };
}

export default async function MyShiftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "WORKER") redirect("/shifts");

  const claims = await prisma.claim.findMany({
    where: { workerId: user.id, status: { in: ["PENDING", "APPROVED"] } },
    include: { shift: { include: { facility: { select: { name: true } } } } },
    orderBy: { shift: { startTime: "asc" } },
  });

  const confirmed = claims.filter((c) => c.status === "APPROVED");
  const pending = claims.filter((c) => c.status === "PENDING");

  const totalUpcoming = confirmed.length;

  return (
    <div>
      <PageHeader title="My shifts" subtitle="Shifts you've claimed or been assigned." />

      {claims.length === 0 ? (
        <EmptyState
          emoji="🗓️"
          title="You haven't claimed any shifts"
          body="Head to Shifts to find open shifts and claim the ones you want."
        />
      ) : (
        <div className="space-y-6">
          {confirmed.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Confirmed ({totalUpcoming})
              </h2>
              <div className="space-y-3">
                {confirmed.map((c) => (
                  <ShiftCard key={c.id} shift={toCardData(c.shift)} viewerRole="WORKER" myClaimStatus="APPROVED" />
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
                  <ShiftCard key={c.id} shift={toCardData(c.shift)} viewerRole="WORKER" myClaimStatus="PENDING" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
