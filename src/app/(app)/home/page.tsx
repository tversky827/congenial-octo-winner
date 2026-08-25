import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isCorporate, isManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { weekStartOf } from "@/lib/week";
import { facilityWeekCoverage } from "@/lib/coverageData";
import { STATUS_META, type CoverageStatus } from "@/lib/coverage";
import { PageHeader } from "@/components/Page";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (isCorporate(user)) return <CorporateHome user={user} />;
  if (isManager(user)) return <SchedulerHome user={user} />;
  return <EmployeeHome user={user} />;
}

// ---- Corporate: org-wide snapshot across facilities ----
async function CorporateHome({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const me = user!;
  const weekStart = weekStartOf(new Date());
  const key = todayKey();

  const facilities = await prisma.facility.findMany({
    where: { active: true, ...orgWhere(me) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const coverage = await Promise.all(
    facilities.map((f) => facilityWeekCoverage(f.id, f.name, weekStart))
  );
  const perFacility = coverage.map((c) => {
    const today = c.days.find((d) => d.dateKey === key) ?? c.days[0];
    return { facilityId: c.facilityId, name: c.facilityName, built: c.built, today };
  });

  const [pendingApprovals, openShifts] = await Promise.all([
    prisma.claim.count({ where: { status: "PENDING", shift: { facility: orgWhere(me) } } }),
    prisma.shift.count({ where: { status: "OPEN", facility: orgWhere(me) } }),
  ]);

  // Roll every facility's "today" into one org status.
  const orgStatus: CoverageStatus = perFacility.some((f) => f.today?.totals.status === "red")
    ? "red"
    : perFacility.some((f) => f.today?.totals.status === "amber")
      ? "amber"
      : "green";
  const orgMeta = STATUS_META[orgStatus];

  return (
    <div>
      <PageHeader title="Today" subtitle="Your organization at a glance." />

      <div className={`card mb-4 flex items-center justify-between ${orgMeta.tone}`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">Org coverage today</p>
          <p className="text-lg font-bold">{orgMeta.dot} {orgMeta.label}</p>
        </div>
        <div className="text-right text-sm">
          <p>{facilities.length} {facilities.length === 1 ? "facility" : "facilities"}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Pending approvals" value={pendingApprovals} href="/manage" />
        <StatCard label="Open in marketplace" value={openShifts} href="/coverage" />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Facilities today</h2>
      <div className="space-y-2">
        {perFacility.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No facilities yet. <Link href="/admin/facilities" className="font-medium text-brand-600">Add one →</Link>
          </p>
        )}
        {perFacility.map((f) => {
          const m = STATUS_META[f.today?.totals.status ?? "green"];
          return (
            <Link key={f.facilityId} href={`/coverage?facility=${f.facilityId}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
              <span className="font-medium text-slate-800">{f.name}</span>
              <span className="text-sm text-slate-500">
                {f.built ? (
                  <>
                    {m.dot} {f.today ? `${f.today.totals.confirmed}/${f.today.totals.required}` : "—"}
                  </>
                ) : (
                  <span className="text-slate-400">No schedule</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---- Scheduler: their facility today ----
async function SchedulerHome({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const me = user!;
  const weekStart = weekStartOf(new Date());
  const key = todayKey();

  if (!me.facilityId) {
    return (
      <div>
        <PageHeader title="Today" />
        <p className="rounded-xl bg-amber-50 px-3 py-4 text-sm text-amber-700">
          You have no facility assigned yet. Ask corporate to assign yours.
        </p>
      </div>
    );
  }

  const facility = await prisma.facility.findUnique({ where: { id: me.facilityId }, select: { name: true } });
  const c = await facilityWeekCoverage(me.facilityId, facility?.name ?? "Your facility", weekStart);
  const today = c.days.find((d) => d.dateKey === key) ?? c.days[0];
  const meta = STATUS_META[today?.totals.status ?? "green"];

  const [pendingApprovals, openShifts] = await Promise.all([
    prisma.claim.count({ where: { status: "PENDING", shift: { facilityId: me.facilityId } } }),
    prisma.shift.count({ where: { status: "OPEN", facilityId: me.facilityId } }),
  ]);

  return (
    <div>
      <PageHeader title="Today" subtitle={facility?.name ?? undefined} />

      <div className={`card mb-4 ${meta.tone}`}>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">Coverage today</p>
        <p className="text-lg font-bold">{meta.dot} {meta.label}</p>
        {today && (
          <p className="mt-1 text-sm opacity-80">
            {today.totals.confirmed}/{today.totals.required} confirmed
            {today.totals.open > 0 && ` · ${today.totals.open} open`}
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Pending approvals" value={pendingApprovals} href="/manage" />
        <StatCard label="Open shifts" value={openShifts} href="/schedule" />
      </div>

      {!c.published && c.built && (
        <Link href="/schedule" className="mb-3 block rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">
          This week isn&apos;t published yet — review & publish →
        </Link>
      )}
      {today && today.lines.some((l) => l.status !== "green") && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Needs attention today</h2>
          <div className="space-y-1">
            {today.lines.filter((l) => l.status !== "green").map((l) => (
              <div key={l.position} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                <span className="font-medium text-slate-700">{STATUS_META[l.status].dot} {l.position}</span>
                <span className="text-slate-500">{l.confirmed}/{l.required} · {l.open} open</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Employee: next shift + activity ----
async function EmployeeHome({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const me = user!;
  const now = new Date();

  const [next, pendingClaims, openForMe] = await Promise.all([
    prisma.shift.findFirst({
      where: {
        assignedToId: me.id,
        status: { in: ["ASSIGNED", "FILLED"] },
        startTime: { gte: now },
        OR: [{ schedule: { published: true } }, { scheduleId: null }],
      },
      include: { facility: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.claim.count({ where: { workerId: me.id, status: "PENDING" } }),
    me.facilityId && me.position
      ? prisma.shift.count({ where: { status: "OPEN", facilityId: me.facilityId, position: me.position } })
      : Promise.resolve(0),
  ]);

  const hours = next ? (next.endTime.getTime() - next.startTime.getTime()) / 3_600_000 : 0;
  const pay = next ? hours * me.baseRate + next.bonus : 0;

  return (
    <div>
      <PageHeader title={`Hi, ${me.name.split(" ")[0]}`} subtitle="Your shifts at a glance." />

      {next ? (
        <div className="card mb-4 bg-brand-600 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">Your next shift</p>
          <p className="mt-1 text-lg font-bold">
            {next.startTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
          </p>
          <p className="text-sm text-white/90">
            {next.startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} –{" "}
            {next.endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}
            {next.facility?.name ? ` · ${next.facility.name}` : ""}
          </p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(pay)}</p>
        </div>
      ) : (
        <div className="card mb-4 text-center text-sm text-slate-500">
          No upcoming shifts. <Link href="/shifts" className="font-medium text-brand-600">Browse open shifts →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Open for you" value={openForMe} href="/shifts" />
        <StatCard label="Awaiting approval" value={pendingClaims} href="/my-shifts" />
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Link>
  );
}
