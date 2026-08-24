import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  position: z.string().trim().max(60).optional().or(z.literal("")),
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
    title: z.string().trim().min(1, "Title is required").max(120),
    position: z.string().trim().min(1, "Position is required").max(60),
    // The facility the shift belongs to. Corporate must pick one; managers post
    // to their own facility, so the route fills it in when omitted.
    facilityId: z.string().trim().optional().or(z.literal("")),
    location: z.string().trim().max(120).optional().or(z.literal("")),
    startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    // Pay is driven by each employee's own rate; a shift only carries optional
    // extras (a differential, overtime rules), so no base $ amount is required.
    differential: z.coerce.number().min(0).max(10000).default(0),
    breakMinutes: z.coerce.number().int().min(0).max(600).default(0),
    overtimeAfterHours: z.coerce.number().min(0).max(24).default(8),
    overtimeMultiplier: z.coerce.number().min(1).max(5).default(1.5),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((v) => new Date(v.endTime).getTime() > new Date(v.startTime).getTime(), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const claimSchema = z.object({
  message: z.string().trim().max(500).optional().or(z.literal("")),
});

export const decideClaimSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const facilityCreateSchema = z.object({
  name: z.string().trim().min(1, "Facility name is required").max(120),
  address: z.string().trim().max(200).optional().or(z.literal("")),
});

export const userUpdateSchema = z.object({
  role: z.enum(["CORPORATE", "MANAGER", "WORKER"]).optional(),
  facilityId: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
  // Employee's hourly pay rate, used to compute what they'd earn on a shift.
  baseRate: z.coerce.number().min(0).max(10000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
