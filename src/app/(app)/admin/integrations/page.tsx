import { PaycorPanel } from "@/components/PaycorPanel";
import { CsvImportPanel } from "@/components/CsvImportPanel";

export const dynamic = "force-dynamic";

export default function AdminIntegrationsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Bring employees, their facility, and their pay rates in from Paycor — no manual entry, and
        rates stay current for the marketplace. Start with a file import, or connect the live API.
      </p>
      <CsvImportPanel />
      <PaycorPanel />
      <p className="mt-3 text-center text-[11px] text-slate-400">
        Paycor location maps to facility · job title maps to CNA/Nurse · pay rate becomes each
        employee&apos;s marketplace rate. Synced employees can be assigned to shifts right away and
        log in by registering with their work email.
      </p>
    </div>
  );
}
