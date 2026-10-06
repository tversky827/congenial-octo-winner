import { describe, it, expect } from "vitest";
import { toE164, renderNotificationSms } from "@/lib/sms";

describe("toE164", () => {
  it("adds +1 to a 10-digit US number", () => {
    expect(toE164("(555) 123-4567")).toBe("+15551234567");
    expect(toE164("555.123.4567")).toBe("+15551234567");
  });
  it("keeps an already-E.164 number", () => {
    expect(toE164("+447911123456")).toBe("+447911123456");
  });
  it("handles a leading-1 11-digit number", () => {
    expect(toE164("1-555-123-4567")).toBe("+15551234567");
  });
  it("returns null for junk / empty", () => {
    expect(toE164("")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164("12345")).toBeNull();
  });
});

describe("renderNotificationSms", () => {
  it("combines title + body and appends an absolute link", () => {
    const t = renderNotificationSms("New shift available", "Facility A · 8h RN", "/pool", "https://app.x.com");
    expect(t).toBe("New shift available: Facility A · 8h RN https://app.x.com/pool");
  });
  it("omits the link when there's none", () => {
    expect(renderNotificationSms("Hours approved", "8 hours.", null)).toBe("Hours approved: 8 hours.");
  });
  it("truncates very long messages", () => {
    const long = renderNotificationSms("T", "x".repeat(400), null);
    expect(long.length).toBeLessThanOrEqual(320);
    expect(long.endsWith("…")).toBe(true);
  });
});
