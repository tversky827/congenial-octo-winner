# ShiftBoard

An in-house shift marketplace — your own "Clipboard Health," but internal. Managers
post open shifts; staff browse them, see exactly what they'd earn, and claim the ones
they want. Managers approve claims, and everyone gets notified along the way.

It's built as an **installable web app (PWA)**: employees open it in a browser on their
phone and tap **Add to Home Screen** to get an app-like icon and full-screen experience —
no App Store required.

## Features

- 📋 **Post & claim shifts** — managers post shifts (role, location, date/time, pay);
  staff browse and claim them.
- 💰 **Automatic pay calculation** — every shift shows the total a worker would earn,
  including differentials and overtime, with a tap-to-expand breakdown.
- ✅ **Approval workflow** — when a worker claims a shift it goes to the manager to
  approve or reassign; approving one claim auto-declines the rest and fills the shift.
- 🔔 **In-app notifications** — workers are told when they get a shift (or don't);
  managers are alerted when someone claims one. A live badge shows unread counts.
- 🔐 **Simple email + password login** — self-contained accounts. A manager invite code
  controls who can post and approve shifts.
- 📱 **Installable PWA** — works on iPhone and Android, add-to-home-screen, offline-aware.

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Prisma** ORM with **SQLite** by default (swap to Postgres for production)
- **Tailwind CSS** for the mobile-first UI
- Session auth via signed JWT cookies (`jose` + `bcryptjs`)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env — at minimum set a long random AUTH_SECRET:
#    openssl rand -base64 48

# 3. Create the database, seed demo data, and generate app icons
npm run setup

# 4. Run it
npm run dev
```

Open http://localhost:3000.

### Demo logins (from the seed script)

| Role    | Email                        | Password      |
| ------- | ---------------------------- | ------------- |
| Manager | `manager@goldwatercare.com`  | `password123` |
| Worker  | `jordan@goldwatercare.com`   | `password123` |
| Worker  | `sam@goldwatercare.com`      | `password123` |
| Worker  | `casey@goldwatercare.com`    | `password123` |

> Change these immediately for any real use.

### Creating your own accounts

- **Workers** self-register from the login screen — no code needed.
- **Managers** register with the **manager invite code** (set as `MANAGER_INVITE_CODE`
  in `.env`; defaults to `goldwater-managers`). Share that code only with schedulers.

## How pay is calculated

For each shift, pay is computed from clock time minus the unpaid break:

```
paid hours   = (end − start) − break
regular pay  = min(paid hours, overtimeAfter) × (hourlyRate + differential)
overtime pay = max(0, paid hours − overtimeAfter) × (hourlyRate + differential) × multiplier
total        = regular pay + overtime pay
```

Defaults: overtime after 8 hours in a shift, at 1.5×. Both are adjustable per shift.
The logic lives in [`src/lib/pay.ts`](src/lib/pay.ts).

## Project structure

```
prisma/schema.prisma      Data model (User, Shift, Claim, Notification)
prisma/seed.ts            Demo accounts + sample shifts
src/lib/                  db, auth/session, pay calc, validation, notifications
src/app/api/              Route handlers (auth, shifts, claims, notifications)
src/app/(app)/            Authenticated screens (shift board, post, my shifts, approvals, alerts)
src/components/           UI (ShiftCard, forms, nav, notification bell, PWA installer)
public/                   PWA manifest, service worker, icons
```

## Deploying online (Vercel + Postgres)

Local dev uses SQLite with zero config. For cloud hosting the app needs a
persistent Postgres database. That's already wired up — you don't edit the
schema by hand:

- `npm run build:vercel` derives a Postgres schema from `prisma/schema.prisma`
  (via `scripts/make-prod-schema.mjs`), creates the tables, and builds the app.
- [`vercel.json`](vercel.json) tells Vercel to use that build command.

Steps:

1. Create a free Postgres database (e.g. [Neon](https://neon.tech)) and copy its
   **pooled** and **direct** connection strings.
2. Import this repo into [Vercel](https://vercel.com/new).
3. Add environment variables in Vercel:
   - `DATABASE_URL` — the pooled connection string
   - `DIRECT_URL` — the direct (non-pooled) connection string
   - `AUTH_SECRET` — a long random string (`openssl rand -base64 48`)
   - `MANAGER_INVITE_CODE` — your chosen manager sign-up code
4. Deploy. On the live site, create the first account and choose
   **"I'm a manager"** with your invite code — no seeding required in production.

Any Postgres host works (Supabase, Railway, RDS, …); just provide the two URLs.

## Roadmap ideas

- Push notifications (Web Push) so alerts reach phones when the app is closed
- Shift filtering by role/location and a calendar view
- CSV export of filled shifts for payroll
- Recurring shift templates
