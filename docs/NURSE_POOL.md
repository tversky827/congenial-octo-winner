# Nurse Pool — Technical Design

**Status:** Phase 1 (design). **Date:** 2026-10-06.
This document is the design gate required before implementation. It describes how
the Nurse Pool float-pool model is built **on top of the existing SNF workforce
platform in this repo**, reusing its auth, RBAC, multi-tenancy, credentials,
time clock, audit log, and CSV infrastructure rather than starting over.

---

## 1. The one principle everything serves

> **A nurse's payroll home is the centralized Nurse Pool. The labor expense for
> every shift is allocated to the facility where the shift was worked.**

Concretely, employment and cost are two different axes and never collapsed:

```
User/Nurse ──is employed by──▶ Nurse Pool (the Organization's pool)   [PAYROLL HOME]
    │
    └──works──▶ ShiftAssignment ──at──▶ Facility ──▶ LaborCostAllocation  [COST CENTER]
```

A nurse is **never** given a facility as their employer. Work location lives on
the `ShiftAssignment`; cost lives on the immutable `LaborCostAllocation` ledger.

---

## 2. Architecture

Already in place and reused (no rewrite):

- **Next.js 14 (App Router) + TypeScript + React 18**, Tailwind, PWA.
- **Prisma ORM**, SQLite in dev / **PostgreSQL (Neon)** in prod.
- **JWT session auth** (jose, httpOnly cookie) + bcrypt.
- **Centralized RBAC** (`src/lib/rbac.ts`) — `can(user, permission)`.
- **Multi-tenancy** via `Organization` + `orgWhere`/`sameOrg` tenant guards.
- **Append-only audit log** (`src/lib/audit.ts`), **Notifications**, **Credentials**,
  **TimeEntry** (clock in/out), CSV export, Zod validation.

Layering (strict — payroll/allocation never runs in a React component):

```
UI (server components + small client islands)
  └─ API routes / server actions  (authz + tenant guard + Zod)
       └─ Services (business logic)
            ├─ EligibilityService      (can this nurse claim this shift?)
            ├─ ClaimService            (transactional assignment, no double-book)
            ├─ PayrollCalculationService  (pure, deterministic, tested)
            ├─ CostAllocationService      (pure build + ledger write)
            ├─ ReconciliationService
            └─ ReportingService / ExportService
                 └─ Prisma (DB access)
```

Pure engines (payroll, overtime split, allocation, reconciliation) are
dependency-free functions in `src/lib/*` with unit tests — the money math is
testable without a database.

---

## 3. Data model (entities & relationships)

Reused as-is: `Organization`, `User`, `Facility`, `Position`, `Credential`,
`TimeEntry`, `Notification`, `AuditLog`. New/extended for the pool:

| Entity | Purpose |
|---|---|
| **User** (extended) | `poolMember`, `licenseType`, `licenseNumber`, `licenseExpiry`, `overtimeMultiplier`; pool nurses have `facilityId = null` and role `POOL_NURSE`. |
| **Facility** (extended) | `costCenterCode`, `glAccount`, `payrollAllocationCode`, `timezone`, `city`/`state`/`zip`/`phone`. |
| **NurseFacilityEligibility** | nurse ↔ facility; where a pool nurse may work. `(userId, facilityId)` unique. |
| **ShiftAssignment** | one nurse's claim on one opening of a shift. Holds scheduled/actual/approved hours, pay rate, differential, regular/OT hours, gross pay, assignment status, claim/approve timestamps, cancellation info. **The payroll spine.** |
| **PayrollPeriod** | a pay window (`startDate`,`endDate`,`status`). |
| **PayrollRecord** | per nurse per period: regular/OT hours, gross wages (payroll home = Nurse Pool). |
| **LaborCostAllocation** | immutable ledger row: period, nurse, assignment, **facility**, cost center, regular/OT hours & pay, total, status, export id. |
| **AccountingExport** | a generated export batch (date range, format, row count, status). |
| **SystemSetting** | per-org configurable rules (OT thresholds, rest period, cancellation window, max hours). |

`Shift` gains `nursesNeeded` (default 1). Status is derived from assignment
count (see §5). The existing facility-employed scheduling flow keeps working;
pool shifts are the new path and use `ShiftAssignment`.

### ERD (core relationships)

```
Organization 1─* Facility 1─* Shift 1─* ShiftAssignment *─1 User(nurse)
                     │                        │
                     │                        └─1 TimeEntry (clock in/out)
                     │                        └─1 PayrollRecord  *─1 PayrollPeriod
                     └───────────◀ LaborCostAllocation ▶─────────┘
User(nurse) *─* Facility  (via NurseFacilityEligibility)
User(nurse) 1─* Credential
```

**Financial records are never deleted** — allocations, payroll records, and
completed shifts use statuses; corrections create adjustment rows.

---

## 4. Authentication & authorization

- **Auth:** existing JWT cookie session; passwords bcrypt-hashed; imported
  nurses get a placeholder hash and claim login via their work email.
- **Authorization:** every API route calls `can(user, permission)` **and** a
  tenant/facility guard server-side. Frontend checks are cosmetic only.
- **Role mapping** (spec → RBAC): Super Admin → `SUPER_ADMIN`/`CORPORATE_ADMIN`;
  Facility Administrator → `FACILITY_ADMIN` (scoped to assigned facilities via
  `facility_users` / `orgWhere` + facility filter); Pool Nurse → **new
  `POOL_NURSE`** (permissions = claim + view-own).
- **Facility isolation:** facility admins see only their facility's shifts,
  assignments, approvals, and cost — enforced in queries, not the UI.

---

## 5. Shift state machine

`DRAFT → OPEN → PARTIALLY_FILLED → FILLED → IN_PROGRESS → COMPLETED →
PENDING_APPROVAL → APPROVED` plus `CANCELLED` / `DISPUTED`. Transitions are
validated in a single `transitionShift()` guard; arbitrary jumps are rejected.
Fill level is a function of `approvedAssignments / nursesNeeded`.

Assignment status: `CLAIMED → CHECKED_IN → WORKED → PENDING_APPROVAL →
APPROVED` / `CANCELLED` / `DISPUTED`.

---

## 6. Shift-claiming workflow (eligibility-gated, race-safe)

1. Pool nurse browses **open shifts at every facility they're eligible for**
   whose required position matches theirs.
2. On claim, `EligibilityService` validates server-side: active nurse, valid
   license + required credentials, facility eligibility, orientation complete,
   **no overlapping assignment**, remaining opening exists, configurable
   max-hours and rest-period rules.
3. `ClaimService` inserts a `ShiftAssignment` inside a transaction using a
   **conditional insert guarded by remaining openings** (count of active
   assignments `< nursesNeeded`), so two nurses can take two seats but never the
   same last seat. Overlap is enforced by re-checking the nurse's assignments in
   the same transaction. Mirrors the existing atomic-fill pattern already tested.

---

## 7. Payroll workflow

1. Shift worked → optional clock in/out (`TimeEntry`) → facility **approves
   hours** on the assignment (approved hours ≠ auto from clock data).
2. On **payroll-period finalize**: for each nurse, `PayrollCalculationService`
   allocates regular vs overtime across the week (configurable weekly/daily
   threshold, multiplier), computes differential + gross per assignment, and
   writes one `PayrollRecord` per nurse (payroll home = Nurse Pool).
3. Deterministic & unit-tested; no OT law is hard-coded — thresholds/multiplier
   come from `SystemSetting`.

---

## 8. Facility cost-allocation workflow

For every **approved** assignment, `CostAllocationService` writes one immutable
`LaborCostAllocation` row → facility + cost center, regular/OT hours & pay,
total. `ReconciliationService` checks **Σ allocations == total payroll** for the
period; a nonzero difference is a **hard block** on finalizing (unless an
authorized override is recorded in the audit log). Reports and the accounting
export read the ledger, not dynamic recomputation.

---

## 9. API / service architecture

- `src/lib/eligibility*.ts`, `src/lib/payrollEngine.ts`,
  `src/lib/costAllocation.ts`, `src/lib/reconcile.ts`, `src/lib/shiftState.ts`,
  `src/lib/settings.ts` — pure/service modules.
- Routes under `/api/pool/*`, `/api/payroll/*`, `/api/assignments/*`,
  `/api/reports/*` — each: authenticate → authorize (`can`) → tenant/facility
  guard → Zod → service → audit.

## 10. Testing strategy

Vitest (already set up). Required coverage: claim concurrency (two seats OK;
third rejected; simultaneous last-seat → exactly one wins), overlap rejection,
rest-period rule, payroll regular/OT/differential math, allocation correctness,
**Σ allocations == payroll**, authorization isolation (facility A ≠ B; nurse ≠
admin), reconciliation flags, and the **§46 acceptance scenario end-to-end**.

## 11. Deployment

Vercel + Neon Postgres; schema applied on build via `prisma db push` (prod can't
be reached from the dev sandbox). Dev uses SQLite. No secrets in code.

---

## 12. Assumptions (made to keep moving; tell me to change any)

1. **"Nurse Pool" = the Organization's pool.** Pool nurses are `User`s with
   `poolMember=true`, `facilityId=null`, role `POOL_NURSE` — reusing the existing
   auth/profile/credential tables instead of a separate `nurses` table. The
   conceptual `nurses`/`users` split in the spec is satisfied by this flag + the
   eligibility join; profile/license/credential data already has a home.
2. **Multi-position shifts** are modeled as `Shift.nursesNeeded` + N
   `ShiftAssignment` rows (per the spec's shift + shift_assignments requirement).
   Existing single-opening facility shifts keep `nursesNeeded=1`.
3. **Overtime default:** 40h/week, 1.5×, no daily OT — all configurable per org
   in `SystemSetting`. (SNF/Illinois-reasonable; not hard-coded law.)
4. **Weekly pay periods**, Mon–Sun, matching the existing scheduling week.
5. **Approved hours are authoritative** for pay; clock data informs but does not
   auto-pay.
6. **Differentials** are a per-shift `$/hour` add-on (already on `Shift.bonus` →
   repurposed/renamed conceptually as differential-capable).
7. Facility admins are scoped to facilities via existing facility assignment;
   cross-facility data is blocked server-side.
8. One org/customer (Goldwater Care) today; the pool is single-tenant but the
   model stays multi-tenant-safe.

## 13. Phased plan (tracked as tasks)

1. **Design** (this doc). 2. **Core data model**. 3. **Payroll + cost-allocation
engines (tested)**. 4. **Pool marketplace claim → assignment**. 5. **Approval →
payroll finalize → allocation ledger → reconciliation**. 6. **Dashboards +
cost-by-facility reports + accounting export**. 7. **§46 acceptance test + seed
pool nurses/eligibility**. 8. **Notifications & shift-matching alerts.**

The existing app stays functional throughout; each phase ships as a tested,
committed increment.
