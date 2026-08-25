import { prisma } from "./db";
import type { TimeRange } from "./eligibility";

/**
 * Every shift a worker is already on the hook for — either assigned to them
 * (ASSIGNED/FILLED) or where they hold an approved claim — as time ranges, used
 * to detect double-booking. `excludeShiftId` drops the shift being evaluated.
 */
export async function workerCommitments(
  workerId: string,
  excludeShiftId?: string
): Promise<TimeRange[]> {
  const shifts = await prisma.shift.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      id: excludeShiftId ? { not: excludeShiftId } : undefined,
      OR: [
        { assignedToId: workerId },
        { claims: { some: { workerId, status: "APPROVED" } } },
      ],
    },
    select: { startTime: true, endTime: true },
  });
  return shifts.map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
}
