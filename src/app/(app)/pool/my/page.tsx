import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/Page";
import { formatMoney, formatHours } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

const STATUS_CHIP: Record<string, string> = {
  CLAIMED: "bg-brand-50 text-brand-700",
  CHECKED_IN: "bg-brand-50 text-brand-700",
  WORKED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function MyPoolShiftsPage() {
  const nurse = await getCurrentUser();
  if (!nurse) redirect("/login");
  if (!nurse.poolMember) redirect("/home");

  const now = new Date();
  const assignments = await prisma.shiftAssignment.findMany({
    where: { nurseId: nurse.id, status: { notIn: ["CANCELLED"] } },
    include: { facility: { select: { name: true } } },
    orderBy: { scheduledStart: "desc" },
    take: 100,
  });

  const upcoming = assignments.filter((a) => a.scheduledStart >= now).reverse();
  const past = assignments.filter((a) => a.scheduledStart < now);

  // Earnings: approved gross where known, else an estimate from scheduled hours.
  const estimate = (a: (typeof assignments)[number]) =>
    a.grossPay ?? (a.approvedHours ?? a.scheduledHours) * a.payRate + a.scheduledHours * a.differentialPerHour;
  const earned = past
    .filter((a) => a.approvalStatus === "APPROVED")
    .reduce((s, a) => s + (a.grossPay ?? 0), 0);

  function Card({ a }: { a: (typeof assignments)[number] }) {
    return (
      <div className="card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{a.facility?.name}</p>
            <p className="text-sm text-slate-500">
              {fmtDate(a.scheduledStart)} · {fmtTime(a.scheduledStart)}–{fmtTime(a.scheduledEnd)}
            </p>
          </div>
          <span className={`chip ${STATUS_CHIP[a.status] ?? "bg-slate-100 text-slate-500"}`}>
            {a.status.replace("_", " ").toLowerCase()}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {formatHours(a.approvedHours ?? a.scheduledHours)}
            {a.approvalStatus === "APPROVED" ? " approved" : " scheduled"}
          </span>
          <span className="font-semibold text-brand-700">
            {formatMoney(estimate(a))}
            {a.approvalStatus !== "APPROVED" && <span className="ml-1 text-xs font-normal text-slate-400">est.</span>}
          </span>
        </div>
      </div>
    );
  }

  const nothing = assignments.length === 0;

  return (
    <div>
      <PageHeader title="My shifts" subtitle="You're a Nurse Pool employee — these are the shifts you've picked up." />

      <div className="mb-4 rounded-2xl bg-brand-600 p-4 text-white">
        <p className="text-xs font-medium uppercase tracking-wide text-white/70">Earned (approved)</p>
        <p className="text-2xl font-bold">{formatMoney(earned)}</p>
      </div>

      <Link href="/pool/preferences" className="mb-4 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-slate-100">
        <span>🔔 Shift alert preferences</span>
        <span className="text-slate-400">›</span>
      </Link>

      {nothing ? (
        <EmptyState emoji="🗓️" title="No shifts yet" body="Claim open shifts from the Pool Shifts tab and they'll show here." />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming ({upcoming.length})</h2>
              <div className="space-y-3">{upcoming.map((a) => <Card key={a.id} a={a} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">History</h2>
              <div className="space-y-3">{past.map((a) => <Card key={a.id} a={a} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
