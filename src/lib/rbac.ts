// Centralized role-based access control.
//
// One source of truth for "who can do what". Routes and UI ask `can(user, perm)`
// instead of hard-coding role-string checks. Legacy role values from the original
// app (CORPORATE / MANAGER / WORKER) are normalized into the new role set, so the
// migration is non-breaking — nothing has to change at once.

export type Role =
  | "SUPER_ADMIN" // platform owner
  | "CORPORATE_ADMIN" // whole organization
  | "FACILITY_ADMIN" // one facility
  | "DON" // director of nursing — clinical staffing
  | "SCHEDULER" // builds & publishes schedules
  | "DEPT_MANAGER" // manages a department's staff/shifts
  | "CHARGE_NURSE" // day-of staffing & attendance
  | "EMPLOYEE" // views schedule, claims shifts
  | "AGENCY"; // external staffing agency (future)

export const ROLES: Role[] = [
  "SUPER_ADMIN", "CORPORATE_ADMIN", "FACILITY_ADMIN", "DON",
  "SCHEDULER", "DEPT_MANAGER", "CHARGE_NURSE", "EMPLOYEE", "AGENCY",
];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  CORPORATE_ADMIN: "Corporate admin",
  FACILITY_ADMIN: "Facility administrator",
  DON: "Director of nursing",
  SCHEDULER: "Scheduler",
  DEPT_MANAGER: "Department manager",
  CHARGE_NURSE: "Charge nurse",
  EMPLOYEE: "Employee",
  AGENCY: "Agency",
};

export type Permission =
  | "org.manage"
  | "facility.manage"
  | "user.manage"
  | "employee.manage"
  | "credential.manage"
  | "coverage.manage" // set the staffing budget / requirements
  | "schedule.view"
  | "schedule.create"
  | "schedule.edit"
  | "schedule.publish"
  | "shift.create" // add an open/marketplace shift
  | "shift.assign" // place an employee on a shift
  | "shift.remove" // add/remove a scheduled day's shifts (admin day override)
  | "shift.cancel"
  | "pickup.approve" // approve/deny marketplace claims
  | "marketplace.claim" // an employee claiming a shift
  | "timecard.view"
  | "timecard.approve"
  | "payroll.view"
  | "analytics.view"
  | "audit.view";

const ALL: Permission[] = [
  "org.manage", "facility.manage", "user.manage", "employee.manage",
  "credential.manage", "coverage.manage", "schedule.view", "schedule.create",
  "schedule.edit", "schedule.publish", "shift.create", "shift.assign",
  "shift.remove", "shift.cancel", "pickup.approve", "marketplace.claim",
  "timecard.view", "timecard.approve", "payroll.view", "analytics.view", "audit.view",
];

const scheduleAll: Permission[] = ["schedule.view", "schedule.create", "schedule.edit", "schedule.publish"];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  CORPORATE_ADMIN: [
    "org.manage", "facility.manage", "user.manage", "employee.manage",
    "credential.manage", "coverage.manage", ...scheduleAll,
    "shift.create", "shift.assign", "shift.remove", "shift.cancel", "pickup.approve",
    "timecard.view", "timecard.approve", "payroll.view", "analytics.view", "audit.view",
  ],
  FACILITY_ADMIN: [
    "facility.manage", "user.manage", "employee.manage", "credential.manage",
    "coverage.manage", ...scheduleAll, "shift.create", "shift.assign",
    "shift.remove", "shift.cancel", "pickup.approve", "timecard.view",
    "timecard.approve", "payroll.view", "analytics.view", "audit.view",
  ],
  DON: [
    ...scheduleAll, "shift.create", "shift.assign", "shift.cancel", "pickup.approve",
    "coverage.manage", "employee.manage", "credential.manage",
    "timecard.view", "timecard.approve", "analytics.view",
  ],
  SCHEDULER: [
    ...scheduleAll, "shift.create", "shift.assign", "shift.cancel", "pickup.approve",
  ],
  DEPT_MANAGER: [
    "schedule.view", "shift.assign", "pickup.approve", "employee.manage",
    "timecard.view", "timecard.approve",
  ],
  CHARGE_NURSE: ["schedule.view", "shift.assign", "pickup.approve", "timecard.view"],
  EMPLOYEE: ["marketplace.claim", "schedule.view"],
  AGENCY: ["schedule.view"],
};

// Map the original app's role strings onto the new roles.
const LEGACY: Record<string, Role> = {
  CORPORATE: "CORPORATE_ADMIN",
  MANAGER: "SCHEDULER",
  WORKER: "EMPLOYEE",
};

export function normalizeRole(role: string | null | undefined): Role {
  if (!role) return "EMPLOYEE";
  if (LEGACY[role]) return LEGACY[role];
  if ((ROLES as string[]).includes(role)) return role as Role;
  return "EMPLOYEE";
}

/** Does this user's role grant the given permission? */
export function can(user: { role: string } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role);
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes(permission);
}

export function permissionsFor(role: string): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}
