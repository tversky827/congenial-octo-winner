import { prisma } from "./db";
import { matchesPreferences, parsePreferences } from "./shiftMatch";
import { scheduledHours } from "./poolRules";
import { sendEmails, renderNotificationEmail, appUrl } from "./email";
import { sendSmsBatch, renderNotificationSms } from "./sms";

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
    select: { id: true, email: true, phone: true, baseRate: true, notifyEmail: true, notifySms: true, mustSetPassword: true, prefMinRate: true, prefFacilityIds: true, prefDaysOfWeek: true },
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

  // Email + SMS the opted-in recipients (best-effort; no-op until configured).
  const active = recipients.filter((n) => !n.mustSetPassword);
  const emailable = active.filter((n) => n.email && n.notifyEmail);
  if (emailable.length > 0) {
    const msg = renderNotificationEmail(title, body, "/pool");
    await sendEmails(emailable.map((n) => ({ to: n.email!, ...msg }))).catch(() => {});
  }
  const smsable = active.filter((n) => n.phone && n.notifySms);
  if (smsable.length > 0) {
    const text = renderNotificationSms(title, body, "/pool", appUrl());
    await sendSmsBatch(smsable.map((n) => ({ to: n.phone!, body: text }))).catch(() => {});
  }

  return recipients.length;
}
