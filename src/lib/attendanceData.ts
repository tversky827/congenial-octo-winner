import { prisma } from "./db";
import { assessReliability, type Reliability, type AttendanceCounts } from "./reliability";

const LATE_GRACE_MINUTES = 5;

/**
 * Classify a worker's past attendance into the counts the reliability score
 * needs. "Past" means the shift has already ended.
 *
 *   completed — a closed time entry (they clocked out)
 *   lates     — clocked in more than the grace window after the scheduled start
 *   noShows   — a shift still ASSIGNED/FILLED that ended with no time entry
 *   callOffs  — recorded CallOff rows for this worker
 */
export async function workerAttendance(workerId: string): Promise<Reliability> {
  const now = new Date();

  const [entries, noShows, callOffs] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { workerId, clockOutAt: { not: null } },
      select: { clockInAt: true, shift: { select: { startTime: true } } },
    }),
    prisma.shift.count({
      where: {
        assignedToId: workerId,
        status: { in: ["ASSIGNED", "FILLED"] },
        endTime: { lt: now },
        timeEntries: { none: {} },
      },
    }),
    prisma.callOff.count({ where: { workerId } }),
  ]);

  const completed = entries.length;
  const lates = entries.filter(
    (e) => e.clockInAt.getTime() > e.shift.startTime.getTime() + LATE_GRACE_MINUTES * 60000
  ).length;

  const counts: AttendanceCounts = { completed, noShows, callOffs, lates };
  return assessReliability(counts);
}

/** Batch version: reliability for many workers at once (people list). */
export async function workersAttendance(workerIds: string[]): Promise<Map<string, Reliability>> {
  const result = new Map<string, Reliability>();
  await Promise.all(
    workerIds.map(async (id) => {
      result.set(id, await workerAttendance(id));
    })
  );
  return result;
}
