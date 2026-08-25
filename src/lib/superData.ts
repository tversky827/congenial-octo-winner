import { prisma } from "./db";
import { estimateMonthly, type PlanEstimate } from "./billing";

export interface OrgOverview {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  facilities: number;
  seats: number; // active users
  shiftsLast30: number;
  plan: PlanEstimate;
}

export interface PlatformOverview {
  orgs: OrgOverview[];
  totals: { orgs: number; facilities: number; seats: number; mrr: number };
}

/** Cross-organization overview for the platform operator. */
export async function platformOverview(): Promise<PlatformOverview> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      _count: { select: { facilities: true } },
    },
  });

  const orgs: OrgOverview[] = await Promise.all(
    organizations.map(async (o) => {
      const [seats, shiftsLast30] = await Promise.all([
        prisma.user.count({ where: { organizationId: o.id, active: true } }),
        prisma.shift.count({ where: { facility: { organizationId: o.id }, startTime: { gte: since } } }),
      ]);
      const plan = estimateMonthly({ facilities: o._count.facilities, seats });
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        facilities: o._count.facilities,
        seats,
        shiftsLast30,
        plan,
      };
    })
  );

  const totals = orgs.reduce(
    (a, o) => ({
      orgs: a.orgs + 1,
      facilities: a.facilities + o.facilities,
      seats: a.seats + o.seats,
      // Only active orgs contribute to recurring revenue.
      mrr: a.mrr + (o.active ? o.plan.monthlyTotal : 0),
    }),
    { orgs: 0, facilities: 0, seats: 0, mrr: 0 }
  );

  return { orgs, totals };
}
