import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BecomeCorporate } from "@/components/BecomeCorporate";
import { PageHeader } from "@/components/Page";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "CORPORATE") {
    return (
      <div>
        <PageHeader title="Setup" />
        <div className="card">
          <p className="text-sm text-slate-600">You&apos;re set up as a corporate admin. 🎉</p>
          <Link href="/admin/facilities" className="btn-primary mt-3 inline-flex">Go to Admin</Link>
        </div>
      </div>
    );
  }

  const corporateExists = (await prisma.user.count({ where: { role: "CORPORATE" } })) > 0;
  if (corporateExists) {
    return (
      <div>
        <PageHeader title="Setup" />
        <div className="card">
          <p className="text-sm text-slate-600">
            Corporate access is already set up. If you need it, ask your corporate admin to grant
            it from Admin → People.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Finish setup"
        subtitle="Turn this account into the corporate admin — you'll be able to add facilities and manage everyone."
      />
      <BecomeCorporate />
      <p className="mt-3 text-xs text-slate-400">
        Use the same management code you set when deploying (the MANAGER_INVITE_CODE value).
      </p>
    </div>
  );
}
