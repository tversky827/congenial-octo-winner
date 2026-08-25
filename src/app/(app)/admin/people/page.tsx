import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgWhere } from "@/lib/tenant";
import { orgPositionNamesOrDefault } from "@/lib/positionsServer";
import { PeopleManager } from "@/components/PeopleManager";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const me = (await getCurrentUser())!;

  const [people, facilities] = await Promise.all([
    prisma.user.findMany({
      where: orgWhere(me),
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        active: true,
        baseRate: true,
        phone: true,
        employeeId: true,
        employmentType: true,
        hireDate: true,
        notes: true,
        facility: { select: { id: true, name: true } },
      },
    }),
    prisma.facility.findMany({
      where: { active: true, ...orgWhere(me) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const positions = await orgPositionNamesOrDefault(me.organizationId);

  // Serialize dates to YYYY-MM-DD for the client date inputs.
  const rows = people.map((p) => ({
    ...p,
    hireDate: p.hireDate ? p.hireDate.toISOString().slice(0, 10) : null,
  }));

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        {people.length} {people.length === 1 ? "person" : "people"} · change anyone&apos;s access or facility.
      </p>
      <PeopleManager people={rows} facilities={facilities} currentUserId={me.id} positions={positions} />
    </div>
  );
}
