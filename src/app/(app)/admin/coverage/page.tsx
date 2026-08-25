import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { orgWhere } from "@/lib/tenant";
import { orgPositionNamesOrDefault } from "@/lib/positionsServer";
import { FacilityFilter } from "@/components/FacilityFilter";
import { TemplateEditor } from "@/components/TemplateEditor";
import { ImportCoverageButton } from "@/components/ImportCoverageButton";

export const dynamic = "force-dynamic";

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: { facility?: string };
}) {
  const me = (await getCurrentUser())!;
  const facilities = await prisma.facility.findMany({
    where: { active: true, ...orgWhere(me) },
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
      <div>
        <ImportCoverageButton />
        <p className="mt-2 text-center text-sm text-slate-500">
          Or add facilities manually in the Facilities tab, then set coverage here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ImportCoverageButton />
      <p className="mb-3 text-sm text-slate-500">
        Set the shifts each facility needs <span className="font-medium">every day</span>. The
        scheduler builds each week from this and fills it. Only you can add or remove shifts on a
        specific day.
      </p>
      <div className="mb-4">
        <FacilityFilter facilities={facilities} />
      </div>
      <TemplateEditor facilityId={facilityId} entries={entries} positions={await orgPositionNamesOrDefault(me.organizationId)} />
    </div>
  );
}
