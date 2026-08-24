import { prisma } from "@/lib/db";
import { FacilityFilter } from "@/components/FacilityFilter";
import { TemplateEditor } from "@/components/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: { facility?: string };
}) {
  const facilities = await prisma.facility.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const facilityId = searchParams.facility || facilities[0]?.id || "";
  const entries = facilityId
    ? await prisma.templateShift.findMany({
        where: { facilityId, active: true },
        orderBy: [{ position: "asc" }, { startTime: "asc" }],
      })
    : [];

  if (facilities.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-slate-500">
        Add a facility first (Facilities tab), then set its weekly coverage here.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Set the shifts each facility needs <span className="font-medium">every day</span>. The
        scheduler builds each week from this and fills it. Only you can add or remove shifts on a
        specific day.
      </p>
      <div className="mb-4">
        <FacilityFilter facilities={facilities} />
      </div>
      <TemplateEditor facilityId={facilityId} entries={entries} />
    </div>
  );
}
