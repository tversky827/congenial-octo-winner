import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AgenciesEditor } from "@/components/AgenciesEditor";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage() {
  const me = (await getCurrentUser())!;
  const orgId = me.organizationId ?? undefined;

  const agencies = orgId
    ? await prisma.agency.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, contactName: true, contactPhone: true, billRate: true },
      })
    : [];

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Staffing agencies you partner with. Schedulers can fill open shifts with an agency when
        in-house staff can&apos;t cover — billed at the agency&apos;s rate.
      </p>
      <AgenciesEditor agencies={agencies} />
    </div>
  );
}
