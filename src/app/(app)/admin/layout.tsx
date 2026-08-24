import { redirect } from "next/navigation";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { AdminTabs } from "@/components/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isCorporate(user)) redirect("/shifts");

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Admin</h1>
      <p className="mb-4 text-sm text-slate-500">Manage facilities and who can access what.</p>
      <AdminTabs />
      {children}
    </div>
  );
}
