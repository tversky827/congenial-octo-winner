import { redirect } from "next/navigation";
import { getCurrentUser, canManage, isCorporate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PostShiftForm } from "@/components/PostShiftForm";
import { PageHeader } from "@/components/Page";

export const dynamic = "force-dynamic";

export default async function NewShiftPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManage(user)) redirect("/shifts");

  const corporate = isCorporate(user);

  // Corporate chooses a facility; a manager posts to their own.
  const facilities = corporate
    ? await prisma.facility.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const facilityName =
    !corporate && user.facilityId
      ? (await prisma.facility.findUnique({ where: { id: user.facilityId }, select: { name: true } }))?.name ?? null
      : null;

  return (
    <div>
      <PageHeader title="Post a shift" subtitle="Fill in the details — your team will see the pay before they claim." />
      <PostShiftForm isCorporate={corporate} facilities={facilities} facilityName={facilityName} />
    </div>
  );
}
