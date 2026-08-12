import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  position: z.string().trim().max(60).optional().or(z.literal("")),
  managerInviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const createShiftSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    position: z.string().trim().min(1, "Position is required").max(60),
    location: z.string().trim().min(1, "Location is required").max(120),
    startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    hourlyRate: z.coerce.number().min(0).max(10000),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
