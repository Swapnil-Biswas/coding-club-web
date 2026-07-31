# Coding Club BMSIT — Platform

A full-stack platform for the college coding club: public site + member features + role-based management.

- **Frontend** — Next.js 16 (App Router, React 19, TypeScript, Tailwind 4). Monochrome "Nothing / Apple-terminal" design.
- **Backend** — Express 4 + `better-sqlite3` (file DB, no server). Sessions via signed httpOnly cookie.
- **Roles** — `public < member < core < core_head < admin`, plus a `club_title` (the **President** is a `core_head` with global core-head permissions).

## Repo layout

```
backend/            Express API (src/), SQLite DB (data/), uploads (uploads/)
  src/index.js      app entry + route mounting + CORS
  src/db.js         entire schema (created idempotently on boot)
  src/lib/          errors, permissions (central), activity log, actor
  src/<module>/     routes.js + service.js per domain
  scripts/seed-admin.js   seed/promote the admin account
frontend/           Next.js app
  app/              routes (pages), components, lib (api, auth, roles, types)
  app/components/   premium landing sections (Hero, Events, Team, …)
  app/components/app/  product chrome: SiteHeader, AuthModal, Notifications, ui, QrImage
```

## Run it (dev)

Two terminals:

```bash
# 1. Backend  →  http://localhost:3001
cd backend
npm install
npm run dev          # or: node src/index.js

# 2. Frontend →  http://localhost:3000
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — **not** the backend port.

### How the browser reaches the API

The frontend defaults to a **same-origin dev proxy**: the browser calls `/api/backend/*` on the Next server, which [rewrites](frontend/next.config.ts) to `http://localhost:3001/*`. This makes the session cookie first-party and **eliminates CORS entirely** in dev.

To point the browser at a backend origin directly (e.g. in production), set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`; the client then calls it over CORS instead. The SSR-only rewrite target is `BACKEND_URL`.

## Email domain

Signups are restricted to **`@bmsit.in`** (server-side, not just the UI). Configured by `ALLOWED_EMAIL_DOMAIN` in `backend/.env`. Non-matching emails get a `400`.

Verification codes are printed to the **backend console** in dev (no SMTP wired). Email delivery of certificates uses SMTP only if `SMTP_HOST` is set.

## Admin account

Admins are never created via signup — they're seeded.

1. Set `SEED_ADMIN_EMAIL` (an `@bmsit.in` address), `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` in `backend/.env`.
2. Run `npm run seed:admin` (creates or promotes that user to `admin`).

> ⚠️ The seed script itself does **not** check the email domain, so double-check the address.

Seed users: `admin@bmsit.in` … (fill in once The Chosen Admin is known).

## Feature map (what's wired)

| Area | Backend | Frontend |
|---|---|---|
| Auth (signup/verify/login/logout/me) | `/auth/*` | `AuthModal` + `lib/auth.tsx` |
| Account / profile / password / photo | `/users/me/*` | `/account` |
| Members role management (core+) | `/users`, `/users/:id/role` | `/members` |
| Events (list/detail/CRUD/publish) | `/events*` | `/events`, `/events/[id]`, dashboard |
| Attendance (CSV import, QR, check-in, export) | `/events/:id/registrants*`, `/events/:id/checkin*` | `/events/[id]/manage`, `/checkin` |
| Teams + members | `/teams*` | `/teams`, dashboard |
| Gallery | `/gallery`, `/photos*` | `/gallery` |
| Sponsors | `/sponsors*` | `/sponsors`, dashboard |
| Join requests | `/join-requests*` | `/join`, dashboard |
| About page content | `/about` | `/about`, dashboard |
| Event history | `/event-history/:eventId` | `/events/[id]`, manage |
| Certificates (templates, generate, email, verify) | `/certificates/*`, `/events/:id/certificates/*`, `/verify/:id` | manage → Certificates, `/verify`, `/account` |
| Leaderboards / announcements | `/events/:id/leaderboard`, `/events/:id/announcements` | `/events/[id]`, manage |
| Notifications | `/notifications/me/*` | header bell |
| Analytics / activity log / search | `/analytics`, `/activity-log`, `/search` | dashboard |

## Roles & what they see (client shows/hides; server always enforces `403`)

- **public / logged out** — browse public pages, join-us, verify certificates, view published public events/gallery/teams/sponsors.
- **member** — + upload gallery photos, view member-only published events, see own QR & certificates & attended events.
- **core** — + Members panel (promote `public→member`), event check-in (scan & manual), create/edit events.
- **core_head** — + publish/complete events, CSV import, export attendance, manage own teams/events, generate & email certificates, manage sponsors/join-requests/about content, dashboards.
- **President** (`core_head` + title) — same as core_head but across **all** teams/events. Cannot promote/demote/disable.
- **admin** — everything + manage roles + assign/remove President.

## Notes

- Data is **seeded** with demo users/events from earlier manual testing. Useful for a walkthrough; reset `backend/data/app.db` for a clean slate.
- The landing page keeps a few **static content sections** (Projects, Resources, Domains, StatsBar) that aren't backed by API data — they're editorial content. Events, Team, Sponsors, and the Join form are live from the backend.
