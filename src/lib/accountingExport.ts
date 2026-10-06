import { prisma } from "./db";
import { toCsv, type CsvColumn } from "./csv";

// Accounting export: one row per labor-cost-allocation, carrying the FACILITY
// cost center and GL account so the Nurse Pool expense lands on the right
// facility in the GL. CSV today; the shape is integration-ready.

export interface AccountingRow {
  date: string;
  employee: string;
  employeeId: string;
  facility: string;
  costCenter: string;
  glAccount: string;
  payrollCode: string;
  hours: number;
  amount: number;
}

const COLUMNS: CsvColumn<AccountingRow>[] = [
  { header: "Date", value: (r) => r.date },
  { header: "Employee", value: (r) => r.employee },
  { header: "Employee ID", value: (r) => r.employeeId },
  { header: "Facility", value: (r) => r.facility },
  { header: "Cost Center", value: (r) => r.costCenter },
  { header: "GL Account", value: (r) => r.glAccount },
  { header: "Payroll Code", value: (r) => r.payrollCode },
  { header: "Hours", value: (r) => r.hours.toFixed(2) },
  { header: "Amount", value: (r) => r.amount.toFixed(2) },
];

export function accountingCsv(rows: AccountingRow[]): string {
  return toCsv(rows, COLUMNS);
}

export interface AccountingExportResult {
  csv: string;
  rowCount: number;
  totalAmount: number;
}

/** Build the accounting export for an org over [from, to) from the ledger. */
export async function buildAccountingExport(
  organizationId: string,
  from: Date,
  to: Date
): Promise<AccountingExportResult> {
  const allocations = await prisma.laborCostAllocation.findMany({
    where: {
      payrollPeriod: { organizationId },
      assignment: { scheduledStart: { gte: from, lt: to } },
    },
    include: {
      nurse: { select: { name: true, employeeId: true } },
      facility: { select: { name: true, costCenterCode: true, glAccount: true, payrollAllocationCode: true } },
      assignment: { select: { scheduledStart: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: AccountingRow[] = allocations.map((a) => ({
    date: a.assignment.scheduledStart.toISOString().slice(0, 10),
    employee: a.nurse.name,
    employeeId: a.nurse.employeeId ?? "",
    facility: a.facility.name,
    costCenter: a.facility.costCenterCode ?? a.costCenter ?? "",
    glAccount: a.facility.glAccount ?? "Nursing Labor",
    payrollCode: a.facility.payrollAllocationCode ?? "",
    hours: Math.round((a.regularHours + a.overtimeHours) * 100) / 100,
    amount: a.totalAllocated,
  }));

  const totalAmount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  return { csv: accountingCsv(rows), rowCount: rows.length, totalAmount };
}
