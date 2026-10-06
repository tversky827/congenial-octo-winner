import { PaycorPanel } from "@/components/PaycorPanel";
import { CsvImportPanel } from "@/components/CsvImportPanel";
import { emailConfigured } from "@/lib/email";
import { smsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default function AdminIntegrationsPage() {
  const email = emailConfigured();
  const sms = smsConfigured();
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Bring employees, their facility, and their pay rates in from Paycor — no manual entry, and
        rates stay current for the marketplace. Start with a file import, or connect the live API.
      </p>
      <CsvImportPanel />
      <PaycorPanel />

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Email notifications</p>
            <p className="text-xs text-slate-500">Send alerts (new shifts, approvals, expiries) by email.</p>
          </div>
          <span className={`chip ${email ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {email ? "Connected" : "Not connected"}
          </span>
        </div>
        {!email && (
          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Set these in your environment to turn email on (in-app alerts work regardless):
            <ul className="mt-1 list-inside list-disc font-mono">
              <li>RESEND_API_KEY</li>
              <li>EMAIL_FROM</li>
              <li>APP_URL</li>
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Text messages (SMS)</p>
            <p className="text-xs text-slate-500">Text nurses who opt in — fastest for last-minute coverage.</p>
          </div>
          <span className={`chip ${sms ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {sms ? "Connected" : "Not connected"}
          </span>
        </div>
        {!sms && (
          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Set these (Twilio) to turn SMS on; nurses opt in from their alert preferences:
            <ul className="mt-1 list-inside list-disc font-mono">
              <li>TWILIO_ACCOUNT_SID</li>
              <li>TWILIO_AUTH_TOKEN</li>
              <li>TWILIO_FROM</li>
            </ul>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-400">
        Paycor location maps to facility · job title maps to CNA/Nurse · pay rate becomes each
        employee&apos;s marketplace rate. Synced employees can be assigned to shifts right away and
        log in by registering with their work email.
      </p>
    </div>
  );
}
