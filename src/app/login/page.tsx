import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "ShiftBoard";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/shifts");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center text-white">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 3h6a1 1 0 0 1 1 1v1h1.5A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5H8V4a1 1 0 0 1 1-1Zm0 3h6V5H9v1Z"
              fill="white"
            />
            <path d="m8.5 13 2 2 4-4" stroke="#236b59" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">{appName}</h1>
        <p className="mt-1 max-w-xs text-sm text-white/80">
          Your team&apos;s open shifts in one place. See the pay, claim the shift.
        </p>
      </div>
      <AuthForm />
    </main>
  );
}
