import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { RegisterSW } from "@/components/RegisterSW";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.role as "MANAGER" | "WORKER";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <TopBar name={user.name} role={role} />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav role={role} />
      <RegisterSW />
    </div>
  );
}
