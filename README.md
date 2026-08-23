# Coding Club BMSIT — Platform

A full-stack platform for the college coding club: public landing site + member features + role-based management dashboard.

- **Frontend** — Next.js 16 (App Router, React 19, TypeScript, Tailwind 4). Monochrome "Nothing / Apple-terminal" design.
- **Backend** — Express 4 + `better-sqlite3` (file DB, no external DB server needed). Sessions via signed `httpOnly` cookie.
- **Roles** — `public < member < core < core_head < admin`, plus a `club_title` (the **President** is a `core_head` with global permissions).

---

## Repo layout

```
backend/
  src/index.ts          app entry, route mounting, CORS, rate limiting
  src/db.ts             entire SQLite schema (created idempotently on boot)
  src/lib/
    permissions.ts      central permission helpers — all role checks live here
    errors.ts           HttpError class + asyncHandler
    imageUpload.ts      managed upload pipeline (multer -> sharp -> disk)
    activityLog.ts      audit trail helper
    types.ts            shared backend TypeScript types
    validation.ts       reusable input validators
  src/<module>/
    routes.ts           Express router
    service.ts          business logic + DB queries
  scripts/seed-admin.ts seed / promote the admin account
  prisma/schema.prisma  Prisma schema for Studio only (NOT used at runtime)
  data/app.db           SQLite database file
  uploads/              user-uploaded files (photos, banners, logos, certs)

frontend/
  app/
    page.tsx            landing page (Hero, StatsBar, Events, Team, ...)
    layout.tsx          root layout (AuthProvider, SiteHeader, Footer, AuthModal)
    globals.css         entire design system (tokens, components, utilities)
    lib/
      api.ts            fetch wrapper + assetUrl() + downloadFile()
      auth.tsx          AuthProvider context + modal state bus
      roles.ts          client-side role helpers (UI-only gating)
      types.ts          TypeScript types mirroring backend JSON shapes
      format.ts         date/label formatters
      config.ts         proxy vs direct API URL switch
    components/         landing page sections (Hero, Events, Team, Sponsors, ...)
    components/app/     SiteHeader, AuthModal, Notifications, ui.tsx, QrImage
    dashboard/          full management dashboard (core_head+)
    events/             events list + detail + manage pages
    members/            members panel (core+)
    gallery/            public gallery (upload for member+, no delete — see Dashboard)
    checkin/            QR scanner + manual check-in (core+)
    account/            profile, password, photo, certificates
    verify/             public certificate verification + ID card
```

---

## Run it (dev)

Open **two** terminals:

```bash
# Terminal 1 — Backend  ->  http://localhost:3001
cd backend
npm install
npm run dev

# Terminal 2 — Frontend ->  http://localhost:3000
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** (not the backend port).

### How the browser reaches the API

The frontend uses a **same-origin dev proxy** by default: the browser calls `/api/backend/*` on the Next.js server, which rewrites those to `http://localhost:3001/*`. The session cookie is first-party — no CORS, no cross-port issues.

To talk to the backend directly (e.g. production with a separate API origin), set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`. The SSR rewrite target is `BACKEND_URL`.

---

## Email domain

Signups are restricted server-side to the configured `ALLOWED_EMAIL_DOMAIN` (default `@bmsit.in`). Non-matching emails get a `400`. The UI also enforces this client-side for fast feedback.

Verification codes are printed to the **backend console** in dev (no SMTP needed). In production, email delivery uses **Resend** (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`).

---

## Admin account

Admins are never created via the public signup flow — they must be seeded:

1. Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` in `backend/.env`.
2. Run `npm run seed:admin` inside `backend/` — creates or promotes that user to `admin`.

> The seed script does **not** check the email domain, so double-check the address.

---

## Roles & permissions

```
public -> member -> core -> core_head -> admin
                               |
                      (club_title = "President" or "Vice President"
                       -> global cross-team core_head powers)
```

| Role | What they can do |
|---|---|
| **public (logged out)** | Browse public pages, verify certificates, submit join request, view published events / gallery / teams / sponsors |
| **public (logged in)** | Everything above + view the members list (name, role, join date only — no email, no actions) |
| **member** | + Upload gallery photos, view member-only events, see own QR code, certificates, attended events |
| **core** | + Event check-in (scan & manual), create/edit events. Views member list same as member (no management actions). |
| **core_head** | + Promote/demote users within `public ↔ member ↔ core` (cannot touch core_head/admin); publish/complete events, CSV import, export attendance, manage own teams/events, generate & email certificates, manage sponsors, join requests, about page, delete gallery photos from their team, full dashboard. **Can see admin users and emails in the members list.** |
| **President** (core_head + title "President") | Same as core_head but across **all** teams/events (no ownership restriction) |
| **Vice President** (core_head + title "Vice President") | Same global override as President |
| **admin** | Everything above + full promote/demote across all roles including core_head↔admin + assign/remove President/VP + manage projects & mentors + delete any user. **The seeded root admin (set via `SEED_ADMIN_EMAIL`) is permanently protected — no other admin can modify or demote it.** |
| **faculty** | Parallel observer — read-only analytics, event data, member list (no email). Cannot create/modify anything |

> The server always enforces permissions with `403`. Client-side role checks only show/hide UI.

---

## Full API Reference

All routes are served at `http://localhost:3001`. In dev the frontend proxies them via `/api/backend/*`.

---

### Auth `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | public | Create account. Email must match `ALLOWED_EMAIL_DOMAIN`. Sends verification code. |
| `POST` | `/auth/verify-email` | public | Submit `{ email, code }` to verify. Returns `{ user }` on success. |
| `POST` | `/auth/resend-verification` | public | Resend verification code to `{ email }`. |
| `POST` | `/auth/login` | public | Login with `{ email, password }`. Sets httpOnly session cookie. Returns `{ user }`. |
| `POST` | `/auth/logout` | auth | Destroys session + clears cookie. |
| `GET`  | `/auth/me` | public | Returns `{ user }` if logged in, `{ user: null }` otherwise. |

---

### Users `/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/users/me` | auth | Returns the logged-in user's full profile. |
| `POST` | `/users/me/photo` | auth | Upload/set profile photo. Accepts multipart file `photo` **or** JSON `{ photo_url }`. |
| `POST` | `/users/me/password` | auth | Change password. Body: `{ currentPassword, newPassword }`. Clears session on success. |
| `GET`  | `/users` | auth (any signed-in user) | List users. `admin`/`core_head` get full fields (email, verified, club_title, is_seeded_admin). Others get slim view (name, role, club_title, joined). **Admin-role users are excluded from the response for non-core_head/non-admin viewers.** |
| `GET`  | `/users/:id` | public | Public profile (only exposed for core, core_head, admin roles). |
| `PATCH`| `/users/:id/role` | core_head+ | Change a user's role. Transition matrix enforced server-side: `core_head` may only move users within `public ↔ member ↔ core`; `admin` has full range. The seeded root admin is immutable. |
| `DELETE`| `/users/:id` | admin | Permanently delete a user and reassign their data to the acting admin. |

---

### Events `/events`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/events` | public | List events visible to viewer (drafts/member-only hidden from public). |
| `GET`  | `/events/:id` | public | Single event. Same visibility rules. |
| `POST` | `/events` | core+ | Create event. Returns `{ event }`. |
| `PATCH`| `/events/:id` | core+ | Update event fields. Publish/complete gated to core_head+ in service. |
| `DELETE`| `/events/:id` | core_head+ | Delete event + associated certificate files from disk. |
| `POST` | `/events/:id/banner` | core+ | Upload/set banner. Accepts multipart file `banner` **or** JSON `{ banner_image_url }`. |

---

### Attendance

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/events/:id/registrants/import` | core_head+ | Import registrants from CSV (field: `csv`). |
| `GET`  | `/events/:id/registrants` | core+ | List all registrants for the event. |
| `POST` | `/events/:id/checkin` | core+ | Check in by QR. Body: `{ qr_code_token }`. |
| `GET`  | `/events/:id/checkin/manual` | core+ | Search registrants by name/email. Query: `?q=`. |
| `POST` | `/events/:id/checkin/manual` | core+ | Mark a registrant as checked in. Body: `{ registrant_id }`. |
| `PATCH`| `/events/:id/checkin/:registrantId` | core_head+ | Undo a check-in. |
| `GET`  | `/events/:id/attendance/export` | core_head+ | Download attendance CSV. |
| `GET`  | `/users/me/attended-events` | auth | Events the logged-in user checked in to. |
| `GET`  | `/users/me/qr-token/:eventId` | auth | Get the logged-in user's QR token for a specific event. |

---

### Teams `/teams`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/teams` | public | List all teams. |
| `GET`  | `/teams/:id` | public | Team detail + members. |
| `GET`  | `/teams/:id/members` | public | Team members only. |
| `GET`  | `/teams/:id/dashboard` | core_head+ | Team dashboard data. |
| `POST` | `/teams` | core_head+ | Create team. Accepts multipart `logo` **or** `{ logo_url }`. |
| `PATCH`| `/teams/:id` | core_head+ | Update team. |
| `DELETE`| `/teams/:id` | core_head+ | Delete team. |
| `POST` | `/teams/:id/members` | core_head+ | Add member. Body: `{ user_id, designation, display_order }`. |
| `PATCH`| `/teams/:id/members/:userId` | core_head+ | Update member designation/order. |
| `DELETE`| `/teams/:id/members/:userId` | core_head+ | Remove member. |
| `GET`  | `/teams/users/:id/teams` | public | Teams a specific user belongs to. |

---

### Gallery `/gallery` & `/photos`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/gallery` | public | List photos. Query: `?limit=`, `?offset=`, `?event_id=`, `?featured=`. |
| `POST` | `/photos` | member+ | Upload photo. Accepts multipart `image` **or** JSON `{ image_url }`. |
| `PATCH`| `/photos/:id` | auth | Update caption/is_featured/sort_order. Gated by ownership. |
| `DELETE`| `/photos/:id` | auth | Delete photo. Uploader can delete own; core_head can delete team-members'; admin/President can delete any. |
| `PATCH`| `/gallery/reorder` | core_head+ | Reorder gallery photos. Body: `{ event_id, ordered_ids[] }`. |

> **Gallery delete was moved from the public `/gallery` page to the Dashboard → Gallery tab.** The public gallery is now display-only. Delete is available to all `core_head+` in the Dashboard (backend enforces team-ownership for plain core heads).

---

### Sponsors `/sponsors`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/sponsors` | public | List all sponsors. |
| `POST` | `/sponsors` | core_head+ | Create sponsor. Accepts multipart `logo` **or** `{ logo_url }`. |
| `PATCH`| `/sponsors/:id` | core_head+ | Update sponsor. |
| `DELETE`| `/sponsors/:id` | core_head+ | Delete sponsor. |

---

### Join Requests `/join-requests`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/join-requests` | public | Submit a join request. Rate-limited to 5/hour per IP. |
| `GET`  | `/join-requests` | core_head+ | List all join requests. |
| `PATCH`| `/join-requests/:id` | core_head+ | Update status/notes. Body: `{ status, notes }`. |

---

### About Page `/about`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/about` | public | Get the about page content. |
| `PATCH`| `/about` | core_head+ | Update about page content. |

---

### Event History `/event-history`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/event-history/:eventId` | public | Get history/winners for a past event. |
| `PUT`  | `/event-history/:eventId` | core_head+ | Create/update history entry. Body: `{ gist, winners }`. |

---

### Leaderboards

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/events/:id/leaderboard` | public | Get leaderboard for an event. |
| `POST` | `/events/:id/leaderboard` | core_head+ | Update/set leaderboard entries. |

---

### Announcements

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/events/:id/announcements` | public | List announcements for an event. |
| `POST` | `/events/:id/announcements` | core_head+ | Post announcement. Body: `{ message }`. |
| `DELETE`| `/announcements/:id` | core_head+ | Delete announcement. |

---

### Certificates

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/certificates/templates` | core_head+ | List all certificate templates. |
| `GET`  | `/certificates/templates/:id` | core_head+ | Get single template. |
| `POST` | `/certificates/templates` | core_head+ | Create template. Accepts multipart `preview` **or** `{ preview_image }`. |
| `PATCH`| `/certificates/templates/:id` | core_head+ | Update template. |
| `GET`  | `/events/:id/certificates` | core_head+ | List certificates for an event. |
| `POST` | `/events/:id/certificates/generate` | core_head+ | Generate single certificate. Body: `{ registrant_id, certificate_type, template_id? }`. |
| `POST` | `/events/:id/certificates/generate/bulk` | core_head+ | Bulk generate. Body: `{ certificate_type, template_id?, mode: 'all'|'checked_in'|'winners'|'volunteers' }`. |
| `POST` | `/events/:id/certificates/email` | core_head+ | Email single certificate. Body: `{ certificate_id }`. |
| `POST` | `/events/:id/certificates/email/bulk` | core_head+ | Email all certificates for event. |
| `GET`  | `/certificates/:id/download` | auth | Download certificate PDF (own for members; any for core_head+). |
| `GET`  | `/verify/:verificationId` | public | Public certificate verification. |
| `GET`  | `/users/me/certificates` | auth | Logged-in user's own certificates. |

---

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/notifications/me/notifications` | auth | List all notifications for the logged-in user. |
| `GET`  | `/notifications/me/notifications/unread-count` | auth | Returns `{ count }` of unread notifications. |
| `POST` | `/notifications/me/notifications/:id/read` | auth | Mark a notification as read. |
| `POST` | `/notifications/me/notifications/mark-all-read` | auth | Mark all notifications as read. |

---

### Analytics `/analytics`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/analytics` | core_head+ / faculty | Overview stats: totals, events by status, users by role, recent events. |
| `GET`  | `/analytics/events/:id` | core_head+ / faculty | Per-event analytics. |

---

### Activity Log `/activity-log`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/activity-log` | admin / President | Audit log of all actions. Query: `?limit=`. |

---

### Search `/search`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/search` | auth | Search events, users, teams. Query: `?q=`. Returns `{ events, users, teams }`. |

---

### Projects `/projects`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/projects` | public | List projects. Query: `?category=`, `?status=`. |
| `GET`  | `/projects/:id` | public | Get single project. |
| `POST` | `/projects` | admin | Create project. |
| `PATCH`| `/projects/:id` | admin | Update project. |
| `DELETE`| `/projects/:id` | admin | Delete project. |

---

### Mentors `/mentors`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/mentors` | public | List active mentors. Contact info only shown to core+. |
| `GET`  | `/mentors/all` | admin | List all mentors including inactive. |
| `GET`  | `/mentors/:id` | public | Get single mentor. Same tiering as list. |
| `POST` | `/mentors` | admin | Create mentor. Accepts multipart `photo` **or** `{ photo_url }`. |
| `PATCH`| `/mentors/:id` | admin | Update mentor. |
| `DELETE`| `/mentors/:id` | admin | Soft-delete mentor (sets is_active = false). |

---

### President & Vice President

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/president` | public | Get current President's public profile. |
| `POST` | `/president` | admin | Assign/update the President (sets club_title). |
| `DELETE`| `/president` | admin | Remove the President title. |
| `GET`  | `/vice-president` | public | Get current Vice President's public profile. |
| `POST` | `/vice-president` | admin | Assign/update the Vice President. |
| `DELETE`| `/vice-president` | admin | Remove the Vice President title. |

---

### Static files

| Path | Description |
|---|---|
| `/uploads/*` | User-uploaded images. Publicly accessible. `Cache-Control: public, max-age=86400`. |
| `/uploads/certificates/*` | Blocked (always 404). PDFs served only via the download endpoint. |
| `/health` | Returns `{ ok: true }`. |

---

## Frontend pages

| Route | Access | Description |
|---|---|---|
| `/` | public | Landing page: Hero, Stats, About, Events, Projects, Team, Resources, Domains, Partners, Join |
| `/events` | public | Events listing |
| `/events/[id]` | public | Event detail, leaderboard, announcements, history |
| `/events/[id]/manage` | core+ | Registrants, check-in, import CSV, certificates, history |
| `/teams` | public | Teams directory |
| `/gallery` | public | Photo gallery (upload for member+, delete moved to Dashboard) |
| `/partners` | public | Partners page (legacy `/sponsors` redirects here) |
| `/about` | public | About page |
| `/join` | public | Join request form |
| `/mentors` | public | Mentors directory |
| `/verify` | public | Certificate verification |
| `/verify/idcard` | public | Member ID card |
| `/members` | auth (any signed-in user) | Members list + role management (management actions for core_head+ only) |
| `/account` | auth | Profile, password, photo, certificates, attended events |
| `/checkin` | core+ | QR scanner + manual check-in |
| `/dashboard` | core_head+ / faculty | Management dashboard |

### Dashboard tabs

| Tab | Access | What it manages |
|---|---|---|
| Overview | all / faculty | Analytics stats, event status, user role breakdown, activity log (admin/President) |
| Events | core_head+ | Create, edit, publish, complete, delete events |
| Teams | core_head+ | Create/edit/delete teams, manage members |
| Certificates | core_head+ | Templates, generate, bulk generate, email |
| **Gallery** | core_head+ | View all photos, delete (own or team-members for core_head; any for admin/President) |
| Partners | core_head+ | Create/edit/delete club partners |
| Join Requests | core_head+ | Review and update join request status |
| About Page | core_head+ | Edit the about page content |
| Projects | admin | Create/edit/delete showcase projects |
| Mentors | admin | Create/edit/deactivate mentors |
| Admin | admin | User role management, delete users |

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_FILE` | No | Path to SQLite DB. Default: `./data/app.db` |
| `SESSION_SECRET` | Prod | Secret for signing session IDs. Min 32 chars. |
| `VERIFICATION_CODE_SECRET` | Prod | HMAC secret for OTP codes. Min 32 chars. Must differ from SESSION_SECRET. |
| `ALLOWED_EMAIL_DOMAIN` | No | Comma-separated domains e.g. `@bmsit.in`. Default: `@example.edu`. |
| `APP_ORIGIN` | Prod | Frontend origin e.g. `https://club.bmsit.in`. Dev default: `http://localhost:3000`. |
| `CORS_ORIGIN` | No | Additional CORS origins (comma-separated). |
| `PORT` | No | HTTP port. Default: `3001`. |
| `RESEND_API_KEY` | Prod | Resend API key for email delivery. |
| `RESEND_FROM_EMAIL` | Prod | Sender address e.g. `Coding Club <noreply@bmsit.in>`. |
| `TRUST_PROXY_CIDRS` | Prod | Proxy CIDRs (Cloudflare, nginx, etc). Set to `none` if no proxy. |
| `RATE_LIMIT_REDIS_URL` | No | Redis URL for persistent rate limiting. Falls back to in-memory. |
| `SEED_ADMIN_EMAIL` | Seed | Email of the root admin to seed. **Also used at runtime to identify and permanently protect the root admin account from modification by other admins.** |
| `SEED_ADMIN_PASSWORD` | Seed | Password of admin to seed. |
| `SEED_ADMIN_NAME` | Seed | Display name of admin to seed. |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Direct backend URL. Leave unset to use the dev proxy. |
| `BACKEND_URL` | SSR-only rewrite target. Default: `http://localhost:3001`. |

---

## Notes

- **Database migrations**: Schema is created idempotently via `db.ts` on every boot. No external migration tool — tables are rebuilt in-place when needed.
- **Prisma**: Only used for `npx prisma studio` (DB browser). Never imported in application code.
- **Image uploads**: multer -> sharp resize -> disk. Orphaned files cleaned up by a 60s background timer.
- **Session cookie**: `__Host-cc_session` in production, `cc_session` in dev. `httpOnly`, `sameSite: lax`, `secure` in prod.
- **CSRF**: Mutations require an `Origin` or `Referer` header matching `APP_ORIGIN`. No separate CSRF token.
- **Static landing content**: `Projects`, `Resources`, `Domains`, and `StatsBar` are static/editorial — not API-backed. Events, Team, Sponsors, and the Join form are live from the backend.
