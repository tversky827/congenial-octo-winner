import { describe, it, expect } from "vitest";
import {
  credentialState,
  hasValidCredential,
  complianceSummary,
} from "@/lib/credentials";

const now = new Date("2026-08-25T00:00:00Z");

describe("credentialState", () => {
  it("is no-expiry when there's no expiration", () => {
    expect(credentialState(null, now)).toBe("no-expiry");
  });
  it("is expired when past", () => {
    expect(credentialState(new Date("2026-08-01T00:00:00Z"), now)).toBe("expired");
  });
  it("is expiring within the warn window", () => {
    expect(credentialState(new Date("2026-09-10T00:00:00Z"), now)).toBe("expiring");
  });
  it("is valid when well in the future", () => {
    expect(credentialState(new Date("2027-01-01T00:00:00Z"), now)).toBe("valid");
  });
});

describe("hasValidCredential", () => {
  const creds = [
    { type: "RN License", expiresAt: new Date("2027-01-01T00:00:00Z"), active: true },
    { type: "BLS/CPR", expiresAt: new Date("2026-08-01T00:00:00Z"), active: true }, // expired
  ];
  it("matches a valid credential case-insensitively", () => {
    expect(hasValidCredential(creds, "rn license", now)).toBe(true);
  });
  it("rejects when the only matching credential is expired", () => {
    expect(hasValidCredential(creds, "BLS/CPR", now)).toBe(false);
  });
  it("rejects when the type is absent", () => {
    expect(hasValidCredential(creds, "TB Test", now)).toBe(false);
  });
  it("ignores inactive credentials", () => {
    expect(hasValidCredential([{ type: "RN License", expiresAt: null, active: false }], "RN License", now)).toBe(false);
  });
});

describe("complianceSummary", () => {
  it("counts expired and expiring and reports compliance", () => {
    const s = complianceSummary(
      [
        { type: "A", expiresAt: new Date("2026-08-01T00:00:00Z"), active: true }, // expired
        { type: "B", expiresAt: new Date("2026-09-10T00:00:00Z"), active: true }, // expiring
        { type: "C", expiresAt: new Date("2027-01-01T00:00:00Z"), active: true }, // valid
      ],
      now
    );
    expect(s).toEqual({ total: 3, expired: 1, expiring: 1, compliant: false });
  });
  it("is compliant with no expired credentials", () => {
    const s = complianceSummary([{ type: "A", expiresAt: null, active: true }], now);
    expect(s.compliant).toBe(true);
  });
});
