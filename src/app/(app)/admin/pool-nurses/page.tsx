import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { PoolNurseManager, type PoolNurseRow } from "@/components/PoolNurseManager";

export const dynamic = "force-dynamic";

export default async function AdminPoolNursesPage() {
  const me = (await getCurrentUser())!;

  const [nurses, facilities] = await Promise.all([
    prisma.user.findMany({
      where: { poolMember: true, ...orgWhere(me) },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, active: true,
        licenseType: true, licenseNumber: true, licenseExpiry: true, baseRate: true,
        eligibilities: { select: { facilityId: true, active: true, orientationComplete: true } },
      },
    }),
    prisma.facility.findMany({ where: { active: true, ...orgWhere(me) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: PoolNurseRow[] = nurses.map((n) => ({
    id: n.id,
    name: n.name,
    email: n.email,
    active: n.active,
    licenseType: n.licenseType,
    licenseNumber: n.licenseNumber,
    licenseExpiry: n.licenseExpiry ? n.licenseExpiry.toISOString().slice(0, 10) : null,
    baseRate: n.baseRate,
    eligibility: Object.fromEntries(
      n.eligibilities.map((e) => [e.facilityId, { active: e.active, orientationComplete: e.orientationComplete }])
    ),
  }));

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Pool nurses are employees of the central Nurse Pool — not any one facility. Add them here,
        set their license and rate, and choose which facilities they&apos;re eligible to work.
      </p>
      <PoolNurseManager nurses={rows} facilities={facilities} />
    </div>
  );
}
