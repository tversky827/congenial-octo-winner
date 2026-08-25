import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin, isCorporate } from "@/lib/auth";
import { platformOverview } from "@/lib/superData";
import { PageHeader } from "@/components/Page";
import { SuperConsole, SuperClaim } from "@/components/SuperConsole";

export const dynamic = "force-dynamic";

export default async function SuperPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Corporate admins can unlock the console with the platform code; everyone
  // else is bounced.
  if (!isSuperAdmin(user)) {
    if (!isCorporate(user)) redirect("/home");
    return (
      <div>
        <PageHeader title="Platform" subtitle="Operator console" />
        <SuperClaim />
      </div>
    );
  }

  const { orgs, totals } = await platformOverview();

  return (
    <div>
      <PageHeader title="Platform" subtitle="Every organization on the platform." />
      <SuperConsole
        orgs={orgs.map((o) => ({
          id: o.id,
          name: o.name,
          active: o.active,
          facilities: o.facilities,
          seats: o.seats,
          shiftsLast30: o.shiftsLast30,
          monthlyTotal: o.plan.monthlyTotal,
        }))}
        totals={totals}
      />
    </div>
  );
}
