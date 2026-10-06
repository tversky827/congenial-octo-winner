import { describe, it, expect } from "vitest";
import { renderNotificationEmail } from "@/lib/email";

describe("renderNotificationEmail", () => {
  it("makes links absolute when a base URL is given", () => {
    const m = renderNotificationEmail("Hours approved", "8 hours approved.", "/pool/my", "https://app.example.com");
    expect(m.subject).toBe("Hours approved");
    expect(m.text).toContain("https://app.example.com/pool/my");
    expect(m.html).toContain('href="https://app.example.com/pool/my"');
  });

  it("falls back to the raw path when no base URL is set", () => {
    const m = renderNotificationEmail("New shift available", "Facility A", "/pool", "");
    expect(m.text).toContain("Open: /pool");
  });

  it("omits the link block when there's no link", () => {
    const m = renderNotificationEmail("License expired", "Renew it.", null, "https://x.com");
    expect(m.text).toBe("Renew it.");
    expect(m.html).not.toContain("Open");
  });

  it("escapes HTML in the title and body", () => {
    const m = renderNotificationEmail("A <b> & C", "1 < 2 & 3 > 0", null);
    expect(m.html).toContain("A &lt;b&gt; &amp; C");
    expect(m.html).toContain("1 &lt; 2 &amp; 3 &gt; 0");
  });
});
