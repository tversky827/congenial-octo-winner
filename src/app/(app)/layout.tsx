import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { RegisterSW } from "@/components/RegisterSW";
import type { Role } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.role as Role;

  // Facility context shown in the top bar.
  let facilityLabel = "All facilities";
  if (role !== "CORPORATE") {
    const facility = user.facilityId
      ? await prisma.facility.findUnique({ where: { id: user.facilityId }, select: { name: true } })
      : null;
    facilityLabel = facility?.name ?? "No facility assigned";
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <TopBar name={user.name} role={role} facilityLabel={facilityLabel} />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav role={role} />
      <RegisterSW />
    </div>
  );
}
