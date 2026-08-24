import { prisma } from "@/lib/db";
import { CreateFacilityForm } from "@/components/CreateFacilityForm";

export const dynamic = "force-dynamic";

export default async function AdminFacilitiesPage() {
  const facilities = await prisma.facility.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, shifts: true } },
    },
  });

  return (
    <div className="space-y-4">
      <CreateFacilityForm />

      {facilities.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          No facilities yet. Add your first one above — then staff can pick it when they sign up.
        </p>
      ) : (
        <div className="space-y-2">
          {facilities.map((f) => (
            <div key={f.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{f.name}</p>
                {f.address && <p className="text-sm text-slate-500">{f.address}</p>}
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{f._count.users} {f._count.users === 1 ? "person" : "people"}</p>
                <p>{f._count.shifts} {f._count.shifts === 1 ? "shift" : "shifts"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
