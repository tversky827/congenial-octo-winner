// Pure mapping between Paycor employee records and our data model. Kept
// dependency-free so every mapping rule is unit-tested; the network client and
// DB writes live elsewhere. Paycor JSON field names vary by API version, so the
// normalizer accepts several candidate keys defensively.

export interface RawPaycorEmployee {
  [key: string]: unknown;
}

export interface NormalizedEmployee {
  externalId: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  name: string;
  location: string | null; // → facility
  jobTitle: string | null; // → position
  status: string | null;
  hourlyRate: number | null;
  active: boolean;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function firstDefined(obj: RawPaycorEmployee, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Map a Paycor job title to one of our two roles, or null if it's neither. */
export function mapJobTitleToPosition(title: string | null | undefined): "CNA" | "Nurse" | null {
  if (!title) return null;
  const t = title.toLowerCase();
  // CNA family.
  if (/\bcna\b/.test(t) || t.includes("certified nursing") || t.includes("nurse aide") || t.includes("nurses aide")) {
    return "CNA";
  }
  // Nurse family (RN, LPN, registered/licensed nurse).
  if (/\b(rn|lpn|lvn)\b/.test(t) || t.includes("nurse") || t.includes("registered nurse") || t.includes("licensed practical")) {
    return "Nurse";
  }
  return null;
}

/** Match a Paycor location string to one of our facilities by name. */
export function matchFacilityId(
  location: string | null | undefined,
  facilities: { id: string; name: string }[]
): string | null {
  if (!location) return null;
  const loc = location.toLowerCase().trim();
  // Exact (case-insensitive) first, then contains (e.g. "Bloomington SNF").
  const exact = facilities.find((f) => f.name.toLowerCase() === loc);
  if (exact) return exact.id;
  const contains = facilities.find(
    (f) => loc.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(loc)
  );
  return contains?.id ?? null;
}

/** Is this Paycor employment status one we treat as active? */
export function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return true; // absent status → assume active
  const s = status.toLowerCase();
  return !(s.includes("terminated") || s.includes("inactive") || s.includes("leave") || s === "t");
}

/** Normalize a raw Paycor record into our shape, tolerant of field-name variants. */
export function normalizePaycorEmployee(raw: RawPaycorEmployee): NormalizedEmployee {
  const firstName = str(firstDefined(raw, ["firstName", "FirstName", "first_name", "First Name", "givenName"])) ?? "";
  const lastName = str(firstDefined(raw, ["lastName", "LastName", "last_name", "Last Name", "familyName", "surname"])) ?? "";
  const email = str(firstDefined(raw, ["email", "Email", "emailAddress", "Email Address", "workEmail", "Work Email", "primaryEmail"]));
  const externalId = str(firstDefined(raw, ["employeeNumber", "EmployeeNumber", "Employee Number", "employeeId", "Employee Id", "Employee ID", "id", "associateId", "Associate ID"]));
  const location = str(firstDefined(raw, ["location", "Location", "locationName", "Location Name", "workLocation", "Work Location", "worksite"]));
  const jobTitle = str(firstDefined(raw, ["position", "Position", "jobTitle", "JobTitle", "Job Title", "title", "Title", "positionTitle", "Position Title"]));
  const status = str(firstDefined(raw, ["employmentStatus", "Employment Status", "status", "Status", "employeeStatus", "Employee Status"]));
  const hourlyRate = num(firstDefined(raw, ["payRate", "PayRate", "Pay Rate", "hourlyRate", "Hourly Rate", "rate", "Rate", "baseRate", "Base Rate", "compensationRate", "annualRate"]));

  const name = `${firstName} ${lastName}`.trim() || email || externalId || "Unknown";

  return {
    externalId,
    email: email ? email.toLowerCase() : null,
    firstName,
    lastName,
    name,
    location,
    jobTitle,
    status,
    hourlyRate,
    active: isActiveStatus(status),
  };
}

export type SkipReason = "no-email" | "inactive" | "unmapped-role" | "unmapped-facility";

export interface PlannedUser {
  email: string;
  name: string;
  externalId: string | null;
  facilityId: string;
  position: "CNA" | "Nurse";
  baseRate: number;
}

export interface SyncPlan {
  create: PlannedUser[];
  update: PlannedUser[];
  skipped: { name: string; reason: SkipReason }[];
}

/**
 * Turn normalized Paycor employees into a plan of creates/updates/skips against
 * the org's facilities and the set of emails that already exist. Pure — the
 * caller performs the writes.
 */
export function buildSyncPlan(
  employees: NormalizedEmployee[],
  facilities: { id: string; name: string }[],
  existingEmails: Set<string>
): SyncPlan {
  const plan: SyncPlan = { create: [], update: [], skipped: [] };

  for (const e of employees) {
    if (!e.active) {
      plan.skipped.push({ name: e.name, reason: "inactive" });
      continue;
    }
    if (!e.email) {
      plan.skipped.push({ name: e.name, reason: "no-email" });
      continue;
    }
    const position = mapJobTitleToPosition(e.jobTitle);
    if (!position) {
      plan.skipped.push({ name: e.name, reason: "unmapped-role" });
      continue;
    }
    const facilityId = matchFacilityId(e.location, facilities);
    if (!facilityId) {
      plan.skipped.push({ name: e.name, reason: "unmapped-facility" });
      continue;
    }

    const planned: PlannedUser = {
      email: e.email,
      name: e.name,
      externalId: e.externalId,
      facilityId,
      position,
      baseRate: e.hourlyRate ?? 0,
    };
    if (existingEmails.has(e.email)) plan.update.push(planned);
    else plan.create.push(planned);
  }

  return plan;
}
