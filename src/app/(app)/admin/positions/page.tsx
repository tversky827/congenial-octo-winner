import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PositionsEditor } from "@/components/PositionsEditor";

export const dynamic = "force-dynamic";

export default async function AdminPositionsPage() {
  const me = (await getCurrentUser())!;
  const orgId = me.organizationId ?? undefined;

  const [departments, positions] = await Promise.all([
    orgId
      ? prisma.department.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    orgId
      ? prisma.position.findMany({
          where: { organizationId: orgId, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, licensed: true, department: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Define the roles your organization staffs. These are the positions used across scheduling,
        the marketplace, and sign-up — every facility can differ.
      </p>
      <PositionsEditor departments={departments} positions={positions} />
    </div>
  );
}
