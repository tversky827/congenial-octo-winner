import { prisma } from "@/lib/db";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { orgWhere } from "@/lib/tenant";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface Row {
  worker: string;
  employeeId: string;
  facility: string;
  position: string;
  date: string;
  clockIn: string;
  clockOut: string;
  hours: string;
  rate: number;
  pay: string;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}
function isoTime(d: Date) {
  return d.toISOString().slice(11, 16);
}

// Payroll timesheet as CSV: one row per completed time entry over [from, to).
// Corporate covers their org; a scheduler covers their own facility.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!canManage(user)) return new Response("Not allowed", { status: 403 });

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return new Response("Bad date range", { status: 400 });
  }

  // Scope: corporate → their org's facilities; scheduler → their facility.
  const facilityFilter = isCorporate(user)
    ? { facility: orgWhere(user) }
    : { facilityId: user.facilityId ?? "__none__" };

  const entries = await prisma.timeEntry.findMany({
    where: {
      clockOutAt: { not: null },
      clockInAt: { gte: from, lt: to },
      shift: facilityFilter,
    },
    orderBy: { clockInAt: "asc" },
    select: {
      clockInAt: true,
      clockOutAt: true,
      actualMinutes: true,
      actualPay: true,
      worker: { select: { name: true, employeeId: true, baseRate: true } },
      shift: { select: { position: true, facility: { select: { name: true } } } },
    },
  });

  const rows: Row[] = entries.map((e) => {
    const mins = e.actualMinutes ?? 0;
    return {
      worker: e.worker.name,
      employeeId: e.worker.employeeId ?? "",
      facility: e.shift.facility?.name ?? "",
      position: e.shift.position,
      date: isoDay(e.clockInAt),
      clockIn: isoTime(e.clockInAt),
      clockOut: e.clockOutAt ? isoTime(e.clockOutAt) : "",
      hours: (mins / 60).toFixed(2),
      rate: e.worker.baseRate,
      pay: (e.actualPay ?? 0).toFixed(2),
    };
  });

  const columns: CsvColumn<Row>[] = [
    { header: "Employee", value: (r) => r.worker },
    { header: "Employee ID", value: (r) => r.employeeId },
    { header: "Facility", value: (r) => r.facility },
    { header: "Position", value: (r) => r.position },
    { header: "Date", value: (r) => r.date },
    { header: "Clock In (UTC)", value: (r) => r.clockIn },
    { header: "Clock Out (UTC)", value: (r) => r.clockOut },
    { header: "Hours", value: (r) => r.hours },
    { header: "Rate", value: (r) => r.rate },
    { header: "Pay", value: (r) => r.pay },
  ];

  const csv = toCsv(rows, columns);

  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "report.timesheet_export", entityType: "Report",
    after: { from: isoDay(from), to: isoDay(to), rows: rows.length },
  });

  const filename = `timesheet_${isoDay(from)}_to_${isoDay(to)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
