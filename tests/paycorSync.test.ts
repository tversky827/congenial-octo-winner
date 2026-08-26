import { describe, it, expect } from "vitest";
import {
  mapJobTitleToPosition,
  matchFacilityId,
  isActiveStatus,
  normalizePaycorEmployee,
  buildSyncPlan,
} from "@/lib/paycorSync";

describe("mapJobTitleToPosition", () => {
  it("maps CNA titles", () => {
    expect(mapJobTitleToPosition("CNA")).toBe("CNA");
    expect(mapJobTitleToPosition("Certified Nursing Assistant")).toBe("CNA");
    expect(mapJobTitleToPosition("Nurse Aide")).toBe("CNA");
  });
  it("maps nurse titles", () => {
    expect(mapJobTitleToPosition("RN")).toBe("Nurse");
    expect(mapJobTitleToPosition("LPN")).toBe("Nurse");
    expect(mapJobTitleToPosition("Registered Nurse")).toBe("Nurse");
    expect(mapJobTitleToPosition("Licensed Practical Nurse")).toBe("Nurse");
  });
  it("returns null for unrelated titles", () => {
    expect(mapJobTitleToPosition("Dietary Aide")).toBeNull();
    expect(mapJobTitleToPosition("")).toBeNull();
    expect(mapJobTitleToPosition(null)).toBeNull();
  });
  it("does not misclassify 'CNA' substring inside another word", () => {
    // \bcna\b requires a word boundary, so "Financial" etc. won't match.
    expect(mapJobTitleToPosition("Financial Analyst")).toBeNull();
  });
});

describe("matchFacilityId", () => {
  const facilities = [
    { id: "f1", name: "Bloomington" },
    { id: "f2", name: "Spring Valley" },
  ];
  it("matches case-insensitively", () => {
    expect(matchFacilityId("bloomington", facilities)).toBe("f1");
  });
  it("matches when the location contains the facility name", () => {
    expect(matchFacilityId("Bloomington SNF", facilities)).toBe("f1");
    expect(matchFacilityId("Spring Valley Care Center", facilities)).toBe("f2");
  });
  it("returns null when nothing matches", () => {
    expect(matchFacilityId("Chicago", facilities)).toBeNull();
    expect(matchFacilityId(null, facilities)).toBeNull();
  });
});

describe("isActiveStatus", () => {
  it("treats terminated/inactive as not active", () => {
    expect(isActiveStatus("Terminated")).toBe(false);
    expect(isActiveStatus("Inactive")).toBe(false);
    expect(isActiveStatus("On Leave")).toBe(false);
  });
  it("treats active/absent as active", () => {
    expect(isActiveStatus("Active")).toBe(true);
    expect(isActiveStatus(null)).toBe(true);
  });
});

describe("normalizePaycorEmployee", () => {
  it("pulls fields across naming variants and lowercases email", () => {
    const n = normalizePaycorEmployee({
      FirstName: "Jordan",
      LastName: "Lee",
      Email: "JORDAN@x.com",
      EmployeeNumber: "E-100",
      Location: "Bloomington",
      Position: "CNA",
      Status: "Active",
      PayRate: "22.50",
    });
    expect(n.name).toBe("Jordan Lee");
    expect(n.email).toBe("jordan@x.com");
    expect(n.externalId).toBe("E-100");
    expect(n.location).toBe("Bloomington");
    expect(n.jobTitle).toBe("CNA");
    expect(n.hourlyRate).toBe(22.5);
    expect(n.active).toBe(true);
  });
});

describe("buildSyncPlan", () => {
  const facilities = [{ id: "f1", name: "Bloomington" }];
  const base = { firstName: "A", lastName: "B", status: "Active" as const };

  it("creates new, updates existing, and skips with reasons", () => {
    const employees = [
      { ...base, externalId: "1", email: "new@x.com", name: "New CNA", location: "Bloomington", jobTitle: "CNA", hourlyRate: 20, active: true },
      { ...base, externalId: "2", email: "old@x.com", name: "Existing", location: "Bloomington", jobTitle: "RN", hourlyRate: 40, active: true },
      { ...base, externalId: "3", email: null, name: "No Email", location: "Bloomington", jobTitle: "CNA", hourlyRate: 20, active: true },
      { ...base, externalId: "4", email: "d@x.com", name: "Dietary", location: "Bloomington", jobTitle: "Cook", hourlyRate: 15, active: true },
      { ...base, externalId: "5", email: "far@x.com", name: "Other Site", location: "Chicago", jobTitle: "CNA", hourlyRate: 20, active: true },
      { ...base, externalId: "6", email: "term@x.com", name: "Termed", location: "Bloomington", jobTitle: "CNA", hourlyRate: 20, active: false },
    ];
    const plan = buildSyncPlan(employees, facilities, new Set(["old@x.com"]));

    expect(plan.create.map((p) => p.email)).toEqual(["new@x.com"]);
    expect(plan.update.map((p) => p.email)).toEqual(["old@x.com"]);
    expect(plan.update[0]).toMatchObject({ position: "Nurse", baseRate: 40, facilityId: "f1" });

    const reasons = plan.skipped.map((s) => s.reason).sort();
    expect(reasons).toEqual(["inactive", "no-email", "unmapped-facility", "unmapped-role"]);
  });

  it("defaults a missing rate to 0", () => {
    const plan = buildSyncPlan(
      [{ ...base, externalId: "1", email: "x@x.com", name: "X", location: "Bloomington", jobTitle: "CNA", hourlyRate: null, active: true }],
      facilities,
      new Set()
    );
    expect(plan.create[0].baseRate).toBe(0);
  });
});
