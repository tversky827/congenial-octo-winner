import { prisma } from "./db";
import { audit } from "./audit";

/**
 * Facility approval of payable hours for an assignment. Approved hours — not raw
 * clock data — are authoritative for payroll. Marks the assignment APPROVED and
 * records who approved it. Idempotent-safe: re-approving updates the hours.
 */
export async function approveAssignmentHours(
  assignmentId: string,
  approver: { id: string; name: string; organizationId: string | null },
  approvedHours: number
) {
  if (approvedHours < 0 || approvedHours > 48) {
    throw new Error("Approved hours out of range");
  }
  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
    include: { facility: { select: { organizationId: true } } },
  });
  if (!assignment) throw new Error("Assignment not found");

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      approvedHours,
      approvalStatus: "APPROVED",
      status: "APPROVED",
      approvedById: approver.id,
      approvedAt: new Date(),
    },
  });

  await audit({
    actorId: approver.id, actorName: approver.name, organizationId: approver.organizationId,
    action: "pool.approve_hours", entityType: "ShiftAssignment", entityId: assignmentId,
    before: { approvedHours: assignment.approvedHours },
    after: { approvedHours },
  });
  return updated;
}
