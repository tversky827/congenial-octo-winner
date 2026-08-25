import { describe, it, expect } from "vitest";
import { can, normalizeRole } from "@/lib/rbac";

describe("RBAC permission engine", () => {
  it("maps legacy roles onto the new role set", () => {
    expect(normalizeRole("CORPORATE")).toBe("CORPORATE_ADMIN");
    expect(normalizeRole("MANAGER")).toBe("SCHEDULER");
    expect(normalizeRole("WORKER")).toBe("EMPLOYEE");
    expect(normalizeRole("SCHEDULER")).toBe("SCHEDULER");
    expect(normalizeRole(null)).toBe("EMPLOYEE");
    expect(normalizeRole("garbage")).toBe("EMPLOYEE");
  });

  it("grants scheduling permissions to schedulers (legacy MANAGER) but not employees", () => {
    expect(can({ role: "MANAGER" }, "shift.assign")).toBe(true);
    expect(can({ role: "MANAGER" }, "schedule.publish")).toBe(true);
    expect(can({ role: "WORKER" }, "shift.assign")).toBe(false);
    expect(can({ role: "WORKER" }, "marketplace.claim")).toBe(true);
  });

  it("reserves org/coverage/audit management for admins", () => {
    expect(can({ role: "CORPORATE" }, "coverage.manage")).toBe(true);
    expect(can({ role: "CORPORATE" }, "audit.view")).toBe(true);
    expect(can({ role: "MANAGER" }, "coverage.manage")).toBe(false); // scheduler fills, doesn't set the budget
    expect(can({ role: "MANAGER" }, "audit.view")).toBe(false);
    expect(can({ role: "WORKER" }, "coverage.manage")).toBe(false);
  });

  it("super admin can do everything; null user can do nothing", () => {
    expect(can({ role: "SUPER_ADMIN" }, "org.manage")).toBe(true);
    expect(can({ role: "SUPER_ADMIN" }, "payroll.view")).toBe(true);
    expect(can(null, "schedule.view")).toBe(false);
  });
});
