import { PaycorPanel } from "@/components/PaycorPanel";

export const dynamic = "force-dynamic";

export default function AdminIntegrationsPage() {
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Connect your HR system so employees, their facility, and their pay rates flow in
        automatically — no manual entry, and rates stay current for the marketplace.
      </p>
      <PaycorPanel />
      <p className="mt-3 text-center text-[11px] text-slate-400">
        Paycor location maps to facility · job title maps to CNA/Nurse · pay rate becomes each
        employee&apos;s marketplace rate. Synced employees can be assigned to shifts right away and
        log in by registering with their work email.
      </p>
    </div>
  );
}
