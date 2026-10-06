import { describe, it, expect } from "vitest";
import { canAccessFacility, facilityScopeWhere } from "@/lib/access";

describe("canAccessFacility", () => {
  it("lets corporate / super admins reach any facility", () => {
    expect(canAccessFacility({ role: "CORPORATE", facilityId: null }, "f1")).toBe(true);
    expect(canAccessFacility({ role: "CORPORATE_ADMIN", facilityId: null }, "f1")).toBe(true);
    expect(canAccessFacility({ role: "SUPER_ADMIN", facilityId: null }, "f9")).toBe(true);
  });

  it("scopes a facility admin to their own facility only", () => {
    const admin = { role: "FACILITY_ADMIN", facilityId: "f1" };
    expect(canAccessFacility(admin, "f1")).toBe(true);
    expect(canAccessFacility(admin, "f2")).toBe(false); // isolation: can't reach another facility
    expect(canAccessFacility(admin, null)).toBe(false);
  });

  it("fails closed for a facility-scoped user with no facility", () => {
    expect(canAccessFacility({ role: "FACILITY_ADMIN", facilityId: null }, "f1")).toBe(false);
  });
});

describe("facilityScopeWhere", () => {
  it("is unfiltered for corporate (optionally narrowed to one)", () => {
    expect(facilityScopeWhere({ role: "CORPORATE_ADMIN", facilityId: null })).toEqual({});
    expect(facilityScopeWhere({ role: "CORPORATE_ADMIN", facilityId: null }, "f3")).toEqual({ facilityId: "f3" });
  });

  it("pins a facility admin to their facility", () => {
    expect(facilityScopeWhere({ role: "FACILITY_ADMIN", facilityId: "f1" })).toEqual({ facilityId: "f1" });
  });

  it("fails closed when a facility-scoped user has no facility", () => {
    expect(facilityScopeWhere({ role: "FACILITY_ADMIN", facilityId: null })).toEqual({ facilityId: "__no_facility__" });
  });
});
