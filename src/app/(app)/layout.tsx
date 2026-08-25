import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin, isCorporate, isManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { RegisterSW } from "@/components/RegisterSW";
import type { Role } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Map the (possibly new) role set onto the three nav personas. Super admins
  // navigate as corporate.
  const role: Role = isCorporate(user) ? "CORPORATE" : isManager(user) ? "MANAGER" : "WORKER";

  // Facility context shown in the top bar.
  let facilityLabel = "All facilities";
  if (role !== "CORPORATE") {
    const facility = user.facilityId
      ? await prisma.facility.findUnique({ where: { id: user.facilityId }, select: { name: true } })
      : null;
    facilityLabel = facility?.name ?? "No facility assigned";
  }

  // First-run: if nobody is corporate yet, nudge this user to claim it.
  const needsCorporateSetup =
    role !== "CORPORATE" && (await prisma.user.count({ where: { role: "CORPORATE" } })) === 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <TopBar name={user.name} role={role} facilityLabel={facilityLabel} superAdmin={isSuperAdmin(user)} />
      {needsCorporateSetup && (
        <Link
          href="/setup"
          className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <span>Finish setup: become the corporate admin →</span>
        </Link>
      )}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav role={role} />
      <RegisterSW />
    </div>
  );
}
