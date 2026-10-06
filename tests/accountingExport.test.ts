import { describe, it, expect } from "vitest";
import { accountingCsv, type AccountingRow } from "@/lib/accountingExport";

describe("accountingCsv", () => {
  it("emits the §24 columns with cost center and amount", () => {
    const rows: AccountingRow[] = [
      { date: "2026-10-15", employee: "Jane Smith", employeeId: "NP-1042", facility: "Facility #7", costCenter: "F007", glAccount: "Nursing Labor", payrollCode: "NP", hours: 8, amount: 304 },
    ];
    const csv = accountingCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Date,Employee,Employee ID,Facility,Cost Center,GL Account,Payroll Code,Hours,Amount");
    expect(lines[1]).toBe("2026-10-15,Jane Smith,NP-1042,Facility #7,F007,Nursing Labor,NP,8.00,304.00");
  });

  it("quotes a facility name containing a comma", () => {
    const rows: AccountingRow[] = [
      { date: "2026-10-15", employee: "Sam", employeeId: "", facility: "Spring Valley, IL", costCenter: "F002", glAccount: "Nursing Labor", payrollCode: "", hours: 8, amount: 320 },
    ];
    expect(accountingCsv(rows).split("\r\n")[1]).toContain('"Spring Valley, IL"');
  });
});
