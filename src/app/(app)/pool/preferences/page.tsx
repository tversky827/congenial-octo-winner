import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePreferences } from "@/lib/shiftMatch";
import { PageHeader } from "@/components/Page";
import { PoolPreferencesForm } from "@/components/PoolPreferencesForm";

export const dynamic = "force-dynamic";

export default async function PoolPreferencesPage() {
  const nurse = await getCurrentUser();
  if (!nurse) redirect("/login");
  if (!nurse.poolMember) redirect("/home");

  // Facilities the nurse is eligible for (the ones worth preferring).
  const eligibilities = await prisma.nurseFacilityEligibility.findMany({
    where: { nurseId: nurse.id, active: true },
    include: { facility: { select: { id: true, name: true } } },
  });
  const facilities = eligibilities.map((e) => e.facility).sort((a, b) => a.name.localeCompare(b.name));

  const prefs = parsePreferences(nurse);

  return (
    <div>
      <PageHeader title="Shift alerts" subtitle="Choose what you want to hear about — we'll notify you when a matching shift opens." />
      <PoolPreferencesForm
        facilities={facilities}
        initial={{
          minRate: prefs.minRate,
          facilityIds: prefs.facilityIds ?? [],
          daysOfWeek: prefs.daysOfWeek ?? [],
          notifyEmail: nurse.notifyEmail,
          notifySms: nurse.notifySms,
          phone: nurse.phone ?? "",
        }}
      />
    </div>
  );
}
