import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Goldwater Care";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/shifts");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-800 to-brand-900 px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-white.svg" alt={appName} className="mb-4 h-14 w-auto" />
        <p className="mt-1 max-w-xs text-sm text-white/80">
          Your team&apos;s open shifts in one place. See the pay, claim the shift.
        </p>
      </div>
      <AuthForm />
    </main>
  );
}
