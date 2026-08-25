import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { parseWeekStart, weekKey, addDays, weekDays, formatWeekRange, DAY_LABELS } from "@/lib/week";
import { facilityWeekCoverage, type FacilityWeekCoverage } from "@/lib/coverageData";
import { STATUS_META } from "@/lib/coverage";
import { PageHeader, EmptyState } from "@/components/Page";
import { FacilityFilter } from "@/components/FacilityFilter";

export const dynamic = "force-dynamic";

export default async function CoverageBoardPage({
  searchParams,
}: {
  searchParams: { week?: string; facility?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManage(user)) redirect("/shifts");

  const corporate = isCorporate(user);
  const weekStart = parseWeekStart(searchParams.week);

  // Which facilities this person can see coverage for.
  const facilities = corporate
    ? await prisma.facility.findMany({
        where: { active: true, ...orgWhere(user) },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : user.facilityId
      ? await prisma.facility.findMany({
          where: { id: user.facilityId },
          select: { id: true, name: true },
        })
      : [];

  if (facilities.length === 0) {
    return (
      <div>
        <PageHeader title="Coverage" />
        <EmptyState
          emoji="🏢"
          title={corporate ? "Add a facility first" : "No facility assigned"}
          body={corporate ? "Create a facility and set its coverage template in Admin." : "Ask corporate to assign your facility."}
        />
      </div>
    );
  }

  // Corporate can narrow to one facility; otherwise show all they can see.
  const selected = corporate && searchParams.facility
    ? facilities.filter((f) => f.id === searchParams.facility)
    : facilities;

  const coverage = await Promise.all(
    selected.map((f) => facilityWeekCoverage(f.id, f.name, weekStart))
  );

  const hrefFor = (week: string) =>
    `/coverage?week=${week}${searchParams.facility ? `&facility=${searchParams.facility}` : ""}`;

  const dayLabels = weekDays(weekStart).map((d, i) => ({
    label: DAY_LABELS[i],
    date: d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" }),
  }));

  return (
    <div>
      <PageHeader title="Coverage" subtitle="Required vs. confirmed staffing, at a glance." />

      {corporate && facilities.length > 1 && (
        <div className="mb-3">
          <FacilityFilter facilities={facilities} />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-xl bg-white px-2 py-2 shadow-sm ring-1 ring-slate-100">
        <Link href={hrefFor(weekKey(addDays(weekStart, -7)))} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">‹ Prev</Link>
        <span className="text-sm font-semibold text-slate-900">{formatWeekRange(weekStart)}</span>
        <Link href={hrefFor(weekKey(addDays(weekStart, 7)))} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Next ›</Link>
      </div>

      <div className="space-y-4">
        {coverage.map((c) => (
          <FacilityCoverageCard key={c.facilityId} c={c} dayLabels={dayLabels} weekKey={weekKey(weekStart)} corporate={corporate} />
        ))}
      </div>
    </div>
  );
}

function FacilityCoverageCard({
  c,
  dayLabels,
  weekKey,
  corporate,
}: {
  c: FacilityWeekCoverage;
  dayLabels: { label: string; date: string }[];
  weekKey: string;
  corporate: boolean;
}) {
  const meta = STATUS_META[c.week.status];
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{c.facilityName}</p>
          <p className="text-xs text-slate-500">
            {c.built ? (c.published ? "Published" : "Draft schedule") : "No schedule built yet"}
          </p>
        </div>
        <span className={`chip ${meta.tone}`}>{meta.dot} {meta.label}</span>
      </div>

      {!c.built ? (
        <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          Nothing scheduled this week.{" "}
          <Link href={`/schedule?week=${weekKey}${corporate ? `&facility=${c.facilityId}` : ""}`} className="font-medium text-brand-600">
            Build it →
          </Link>
        </div>
      ) : (
        <>
          {/* Per-day status strip */}
          <div className="grid grid-cols-7 gap-1">
            {c.days.map((d, i) => {
              const m = STATUS_META[d.totals.status];
              return (
                <div key={d.dateKey} className="rounded-lg bg-slate-50 py-2 text-center">
                  <div className="text-[10px] font-medium uppercase text-slate-400">{dayLabels[i].label}</div>
                  <div className="text-base leading-tight">{m.dot}</div>
                  <div className="text-[10px] text-slate-500">{d.totals.confirmed}/{d.totals.required}</div>
                </div>
              );
            })}
          </div>

          {/* Week per-position rollup, worst first */}
          <div className="mt-3 space-y-1">
            {c.days[0]?.lines.length === 0 ? null : (
              <PositionRollup c={c} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PositionRollup({ c }: { c: FacilityWeekCoverage }) {
  // Aggregate each position across the week for a compact summary line.
  const agg = new Map<string, { required: number; confirmed: number; open: number; gap: number }>();
  for (const d of c.days) {
    for (const l of d.lines) {
      const cur = agg.get(l.position) ?? { required: 0, confirmed: 0, open: 0, gap: 0 };
      cur.required += l.required;
      cur.confirmed += l.confirmed;
      cur.open += l.open;
      cur.gap += l.gap;
      agg.set(l.position, cur);
    }
  }
  const rows = [...agg.entries()].sort((a, b) => b[1].gap - a[1].gap || a[0].localeCompare(b[0]));
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">This week</p>
      {rows.map(([position, v]) => (
        <div key={position} className="flex items-center justify-between rounded-lg px-1 py-1 text-sm">
          <span className="font-medium text-slate-700">{position}</span>
          <span className="text-slate-500">
            <span className={v.gap > 0 ? "font-semibold text-red-600" : "text-emerald-600"}>{v.confirmed}</span>
            /{v.required} confirmed
            {v.open > 0 && <span className="text-amber-600"> · {v.open} open</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
