import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/Page";
import { PoolClaimButton } from "@/components/PoolClaimButton";
import { formatMoney, formatHours } from "@/lib/format";
import { scheduledHours } from "@/lib/poolRules";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export default async function PoolBoardPage() {
  const nurse = await getCurrentUser();
  if (!nurse) redirect("/login");
  if (!nurse.poolMember) redirect("/home");

  // Facilities this nurse is eligible for (active + oriented).
  const eligibilities = await prisma.nurseFacilityEligibility.findMany({
    where: { nurseId: nurse.id, active: true, orientationComplete: true },
    select: { facilityId: true },
  });
  const facilityIds = eligibilities.map((e) => e.facilityId);

  // Shifts this nurse hasn't already claimed.
  const myClaims = await prisma.shiftAssignment.findMany({
    where: { nurseId: nurse.id, status: { notIn: ["CANCELLED"] } },
    select: { shiftId: true },
  });
  const claimedIds = new Set(myClaims.map((c) => c.shiftId));

  const now = new Date();
  const shifts =
    facilityIds.length === 0
      ? []
      : await prisma.shift.findMany({
          where: {
            facilityId: { in: facilityIds },
            status: { in: ["OPEN", "PARTIALLY_FILLED"] },
            startTime: { gte: now },
            // Match the nurse's license, or (no license requirement) their position.
            OR: [
              { requiredLicense: nurse.licenseType ?? "__none__" },
              { requiredLicense: null, position: nurse.position ?? "__none__" },
            ],
          },
          include: { facility: { select: { name: true } } },
          orderBy: { startTime: "asc" },
          take: 100,
        });

  const available = shifts.filter((s) => !claimedIds.has(s.id) && s.seatsFilled < s.nursesNeeded);

  return (
    <div>
      <PageHeader title="Available shifts" subtitle="Open shifts at every facility you're approved for." />

      {facilityIds.length === 0 ? (
        <EmptyState emoji="🏥" title="No facilities yet" body="You're not approved at any facility yet. Your administrator sets this up." />
      ) : available.length === 0 ? (
        <EmptyState emoji="✅" title="Nothing open right now" body="Check back soon — new shifts show up here as facilities post them." />
      ) : (
        <div className="space-y-3">
          {available.map((s) => {
            const hours = scheduledHours(s.startTime, s.endTime, s.breakMinutes);
            const pay = hours * nurse.baseRate + hours * s.differentialPerHour;
            const seatsLeft = s.nursesNeeded - s.seatsFilled;
            return (
              <div key={s.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{s.facility?.name}</p>
                    <p className="text-sm text-slate-500">
                      {fmtDate(s.startTime)} · {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                    </p>
                  </div>
                  <span className="chip bg-brand-50 text-brand-700">{s.requiredLicense ?? s.position}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{formatHours(hours)}{seatsLeft > 1 ? ` · ${seatsLeft} seats open` : ""}</span>
                  <span className="text-lg font-bold text-brand-700">{formatMoney(pay)}</span>
                </div>
                {s.differentialPerHour > 0 && (
                  <p className="text-xs text-amber-600">Includes {formatMoney(s.differentialPerHour)}/hr differential</p>
                )}
                <PoolClaimButton shiftId={s.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
