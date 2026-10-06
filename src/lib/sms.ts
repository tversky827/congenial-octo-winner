// SMS channel for notifications. Provider-agnostic and env-driven: a no-op until
// Twilio credentials are set, then sends via Twilio's REST API (no SDK). Built
// the same way as the email channel so it plugs into notify() behind an opt-in.

export interface SmsMessage {
  to: string;
  body: string;
}

export function smsConfigured(): boolean {
  return !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM;
}

/** Best-effort E.164 normalization (pure, unit-tested). Returns null if unusable. */
export function toE164(phone: string | null | undefined, defaultCountry = "1"): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed; // already E.164
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** Build the SMS text for a notification (pure). Keeps it short, link last. */
export function renderNotificationSms(title: string, body: string, link: string | null, base = ""): string {
  const href = link ? (base ? `${base.replace(/\/$/, "")}${link}` : link) : null;
  const core = `${title}: ${body}`;
  const text = href ? `${core} ${href}` : core;
  // SMS segments are ~160 chars; keep it reasonable but don't hard-truncate links.
  return text.length > 320 ? `${text.slice(0, 317)}…` : text;
}

/** Send one SMS. Returns {sent:false} (never throws) when unconfigured or on error. */
export async function sendSms(msg: SmsMessage): Promise<{ sent: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { sent: false, error: "sms not configured" };

  const to = toE164(msg.to);
  if (!to) return { sent: false, error: "invalid phone" };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: msg.body }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { sent: false, error: `${res.status} ${t.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Best-effort batch send; returns how many succeeded. Never throws. */
export async function sendSmsBatch(messages: SmsMessage[]): Promise<number> {
  if (messages.length === 0 || !smsConfigured()) return 0;
  const results = await Promise.allSettled(messages.map(sendSms));
  return results.filter((r) => r.status === "fulfilled" && r.value.sent).length;
}
