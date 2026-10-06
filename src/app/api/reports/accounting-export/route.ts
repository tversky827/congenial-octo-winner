import { getCurrentUser, isCorporate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildAccountingExport } from "@/lib/accountingExport";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Accounting export (CSV) of Nurse Pool labor allocated by facility/cost center.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!isCorporate(user)) return new Response("Corporate access required", { status: 403 });
  if (!user.organizationId) return new Response("No organization", { status: 400 });

  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return new Response("Bad date range", { status: 400 });

  const { csv, rowCount, totalAmount } = await buildAccountingExport(user.organizationId, from, to);

  // Record the export batch (financial history / traceability).
  await prisma.accountingExport.create({
    data: { organizationId: user.organizationId, format: "csv", rowCount, totalAmount, createdById: user.id },
  });
  await audit({
    actorId: user.id, actorName: user.name, organizationId: user.organizationId,
    action: "accounting.export", entityType: "AccountingExport",
    after: { from: isoDay(from), to: isoDay(to), rowCount, totalAmount },
  });

  const filename = `nurse-pool-accounting_${isoDay(from)}_to_${isoDay(to)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
