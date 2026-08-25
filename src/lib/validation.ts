import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  // Staff role — required for WORKER (enforced in the route). Validated against
  // the organization's configured positions in the route.
  position: z.string().trim().min(1).max(60).optional(),
  // Which kind of account to create. MANAGER/CORPORATE require the management code.
  accessType: z.enum(["WORKER", "MANAGER", "CORPORATE"]).default("WORKER"),
  // Required for WORKER and MANAGER (they belong to one facility). Ignored for CORPORATE.
  facilityId: z.string().trim().optional().or(z.literal("")),
  // Unlocks MANAGER / CORPORATE sign-up.
  managementCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const createShiftSchema = z
  .object({
    position: z.string().trim().min(1, "Choose a role").max(60),
    // The facility the shift belongs to. Corporate must pick one; managers post
    // to their own facility, so the route fills it in when omitted.
    facilityId: z.string().trim().optional().or(z.literal("")),
    startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    // Pay is the employee's own rate × hours. A shift can add an optional flat
    // pick-up bonus, but no base $ amount is required.
    bonus: z.coerce.number().min(0).max(100000).default(0),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((v) => new Date(v.endTime).getTime() > new Date(v.startTime).getTime(), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const claimSchema = z.object({
  message: z.string().trim().max(500).optional().or(z.literal("")),
});

export const callOffSchema = z.object({
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

export const decideClaimSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const facilityCreateSchema = z.object({
  name: z.string().trim().min(1, "Facility name is required").max(120),
  address: z.string().trim().max(200).optional().or(z.literal("")),
});

const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

// Daily coverage entry — applies to every day of the week.
export const templateShiftSchema = z.object({
  facilityId: z.string().min(1),
  position: z.string().trim().min(1).max(60),
  startTime: timeString,
  endTime: timeString,
  count: z.coerce.number().int().min(1).max(50).default(1),
  bonus: z.coerce.number().min(0).max(100000).default(0),
});

// Admin day override — add an extra shift to one specific day of a schedule.
export const addShiftSchema = z.object({
  dayOffset: z.coerce.number().int().min(0).max(6),
  position: z.string().trim().min(1).max(60),
  startTime: timeString,
  endTime: timeString,
  bonus: z.coerce.number().min(0).max(100000).default(0),
});

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const positionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  departmentId: z.string().trim().optional().or(z.literal("")),
  licensed: z.boolean().optional().default(false),
  requiredCredential: z.string().trim().max(80).optional().or(z.literal("")),
});

export const credentialCreateSchema = z.object({
  workerId: z.string().min(1),
  type: z.string().trim().min(1, "Type is required").max(80),
  number: z.string().trim().max(80).optional().or(z.literal("")),
  // Accept YYYY-MM-DD or ISO; validated/parsed in the route.
  issuedAt: z.string().trim().optional().or(z.literal("")),
  expiresAt: z.string().trim().optional().or(z.literal("")),
});

export const generateWeekSchema = z.object({
  facilityId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bad week"),
});

export const assignShiftSchema = z.object({
  // null / empty clears the assignment (back to planned or open).
  workerId: z.string().nullable().optional(),
});

export const employmentTypes = ["FULL_TIME", "PART_TIME", "PER_DIEM"] as const;

export const userUpdateSchema = z.object({
  role: z.enum(["CORPORATE", "MANAGER", "WORKER"]).optional(),
  facilityId: z.string().trim().nullable().optional(),
  position: z.string().trim().min(1).max(60).nullable().optional(),
  active: z.boolean().optional(),
  // Employee's hourly pay rate, used to compute what they'd earn on a shift.
  baseRate: z.coerce.number().min(0).max(10000).optional(),
  // --- Employment profile ---
  phone: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  employeeId: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  employmentType: z.enum(employmentTypes).nullable().optional(),
  // Accepts an ISO date or a plain YYYY-MM-DD (from an <input type=date>).
  hireDate: z.string().trim().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
