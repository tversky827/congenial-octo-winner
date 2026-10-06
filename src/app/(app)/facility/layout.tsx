import { redirect } from "next/navigation";
import { getCurrentUser, isFacilityAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FacilityTabs } from "@/components/FacilityTabs";

export default async function FacilityLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isFacilityAdmin(user)) redirect("/home");

  const facility = user.facilityId
    ? await prisma.facility.findUnique({ where: { id: user.facilityId }, select: { name: true } })
    : null;

  if (!facility) {
    return (
      <div>
        <h1 className="mb-1 text-xl font-bold text-slate-900">Facility admin</h1>
        <p className="rounded-xl bg-amber-50 px-3 py-4 text-sm text-amber-700">
          You&apos;re not assigned to a facility yet. Ask your corporate admin to assign yours.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">{facility.name}</h1>
      <p className="mb-4 text-sm text-slate-500">Everything here is scoped to your facility.</p>
      <FacilityTabs />
      {children}
    </div>
  );
}
