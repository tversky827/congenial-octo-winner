import { redirect } from "next/navigation";
import { getCurrentUser, canManage } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(canManage(user) ? "/schedule" : "/shifts");
}
