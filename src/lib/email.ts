// Email channel for notifications. Provider-agnostic and env-driven: it stays a
// no-op until credentials are set, then sends via Resend's HTTP API (no SDK
// dependency). The notification layer calls this alongside the in-app write, so
// email is additive — SMS/push can plug in the same way later.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export function appUrl(): string {
  return (process.env.APP_URL || "").replace(/\/$/, "");
}

/** Build a notification email (pure — unit-tested). Links become absolute when APP_URL is set. */
export function renderNotificationEmail(
  title: string,
  body: string,
  link: string | null,
  base = appUrl()
): { subject: string; text: string; html: string } {
  const href = link ? (base ? `${base}${link}` : link) : null;
  const text = href ? `${body}\n\nOpen: ${href}` : body;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#00263c;font-size:18px;margin:0 0 8px">${esc(title)}</h2>
  <p style="color:#334155;font-size:14px;line-height:1.5;margin:0 0 16px">${esc(body)}</p>
  ${href ? `<a href="${esc(href)}" style="display:inline-block;background:#00263c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Open</a>` : ""}
</div>`;
  return { subject: title, text, html };
}

/** Send one email. Returns {sent:false} (never throws) when unconfigured or on error. */
export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false, error: "email not configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html }),
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
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  if (messages.length === 0 || !emailConfigured()) return 0;
  const results = await Promise.allSettled(messages.map(sendEmail));
  return results.filter((r) => r.status === "fulfilled" && r.value.sent).length;
}
