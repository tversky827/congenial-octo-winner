import { prisma } from "./db";
import { matchesPreferences, parsePreferences } from "./shiftMatch";
import { scheduledHours } from "./poolRules";
import { sendEmails, renderNotificationEmail } from "./email";

/**
 * Notify pool nurses that a new shift is available. Recipients must be eligible
 * and oriented at the facility, license-matched, active, and the shift must
 * match their preferences. Never auto-assigns (§22) — just an in-app alert.
 */
export async function notifyEligibleNurses(shiftId: string): Promise<number> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { facility: { select: { id: true, name: true } } },
  });
  if (!shift || !shift.facilityId) return 0;

  // Nurses eligible + oriented at this facility.
  const eligible = await prisma.nurseFacilityEligibility.findMany({
    where: { facilityId: shift.facilityId, active: true, orientationComplete: true },
    select: { nurseId: true },
  });
  if (eligible.length === 0) return 0;

  const nurses = await prisma.user.findMany({
    where: {
      id: { in: eligible.map((e) => e.nurseId) },
      poolMember: true,
      active: true,
      ...(shift.requiredLicense ? { licenseType: shift.requiredLicense } : {}),
    },
    select: { id: true, email: true, baseRate: true, notifyEmail: true, mustSetPassword: true, prefMinRate: true, prefFacilityIds: true, prefDaysOfWeek: true },
  });
  if (nurses.length === 0) return 0;

  const dayOfWeek = shift.startTime.getUTCDay();
  const dateLabel = shift.startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const hours = scheduledHours(shift.startTime, shift.endTime, shift.breakMinutes);

  const recipients = nurses.filter((n) =>
    matchesPreferences(
      { facilityId: shift.facilityId!, effectiveRate: n.baseRate + shift.differentialPerHour, dayOfWeek },
      parsePreferences(n)
    )
  );
  if (recipients.length === 0) return 0;

  const title = "New shift available";
  const body = `${shift.facility?.name} · ${dateLabel} · ${hours}h ${shift.requiredLicense ?? shift.position}`;

  await prisma.notification.createMany({
    data: recipients.map((n) => ({ userId: n.id, title, body, link: "/pool" })),
  });

  // Email the opted-in recipients (best-effort; no-op until email is configured).
  const emailable = recipients.filter((n) => n.email && n.notifyEmail && !n.mustSetPassword);
  if (emailable.length > 0) {
    const msg = renderNotificationEmail(title, body, "/pool");
    await sendEmails(emailable.map((n) => ({ to: n.email!, ...msg }))).catch(() => {});
  }

  return recipients.length;
}
