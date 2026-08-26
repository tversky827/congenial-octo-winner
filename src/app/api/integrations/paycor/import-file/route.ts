import { NextResponse } from "next/server";
import { getCurrentUser, isCorporate } from "@/lib/auth";
import { ensureOrganizationForUser } from "@/lib/org";
import { parseCsv } from "@/lib/csv";
import { normalizePaycorEmployee } from "@/lib/paycorSync";
import { reconcileEmployees } from "@/lib/paycorRun";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Import employees from an uploaded Paycor export (CSV). Same mapping and
// reconcile logic as the live API sync — Location → facility, Job Title →
// CNA/Nurse, pay rate → marketplace rate. Corporate only.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isCorporate(user)) {
    return NextResponse.json({ error: "Corporate access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) {
    return NextResponse.json({ error: "No CSV content received." }, { status: 400 });
  }

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "The file has a header but no employee rows." }, { status: 400 });
  }

  const organizationId = await ensureOrganizationForUser(user);
  const employees = rows.map(normalizePaycorEmployee);
  const summary = await reconcileEmployees(
    organizationId,
    employees,
    { id: user.id, name: user.name },
    "integration.paycor_import_file"
  );
  return NextResponse.json(summary);
}
