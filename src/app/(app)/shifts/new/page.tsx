import { redirect } from "next/navigation";
import { getCurrentUser, isManager } from "@/lib/auth";
import { PostShiftForm } from "@/components/PostShiftForm";
import { PageHeader } from "@/components/Page";

export default async function NewShiftPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManager(user)) redirect("/shifts");

  return (
    <div>
      <PageHeader title="Post a shift" subtitle="Fill in the details — your team will see the pay before they claim." />
      <PostShiftForm />
    </div>
  );
}
