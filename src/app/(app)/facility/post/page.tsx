import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PoolShiftPostForm } from "@/components/PoolShiftPostForm";

export const dynamic = "force-dynamic";

export default async function FacilityPostPage() {
  const me = (await getCurrentUser())!;
  if (!me.facilityId) return null;

  const facility = await prisma.facility.findUnique({ where: { id: me.facilityId }, select: { id: true, name: true } });
  // The form is locked to this admin's single facility.
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Post a shift for the Nurse Pool. Eligible, oriented nurses are alerted and can claim it.
      </p>
      <PoolShiftPostForm facilities={facility ? [facility] : []} />
    </div>
  );
}
