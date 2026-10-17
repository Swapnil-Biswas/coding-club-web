# Coding Club BMSIT — Recruitment 2026–27 Implementation Plan

> **Purpose:** An implementation-ready plan for adding end-to-end recruitment to the existing Coding Club website. This plan is based on `recutiment26-27.pdf` and the explicit operational requirements provided alongside it. It specifies the intended behavior, data captured, security, backups, administration, testing, deployment, and acceptance criteria. It is a plan, not an implementation.

## 1. Non-negotiable requirements

These requirements must be treated as release blockers, not optional enhancements.

1. Add a **Recruitments** entry to the public website navigation while recruitment is open.
2. Core Heads and authorized Admins can **open or close recruitment** from an authenticated admin interface. The state must be persisted in SQL and controlled server-side.
3. When recruitment is open, a visitor landing on the website sees a clear, dismissible notification/announcement that recruitment is open and can navigate to the application.
4. When recruitment is closed:
   - Remove the Recruitments item from the public navigation.
   - Do not display the recruitment-open notification.
   - Do not accept new applications, even if someone visits a saved URL or calls an API directly.
   - Keep existing applications and admin access to historical data intact.
5. **SQL is the primary, durable source of truth.** Every submitted application and its structured responses must be committed to the SQL database before the application is reported as successful.
6. **Google Sheets is a secondary backup/operational export**, not the primary database. Use one consolidated spreadsheet/workbook for this recruitment cycle and a single canonical `Applications` tab with all teams represented. Do not create independently maintained spreadsheets per team.
7. Make SQL-to-Sheets synchronization reliable: queued, idempotent, retried, observable, and recoverable. An outage or quota error in Google Sheets must not lose or block a successfully saved application.
8. Implement defense in depth against abuse and attacks, including rate limiting, server-side validation, authorization, safe uploads, bot/duplicate protections, security headers, logging, backup/restore procedures, and security testing.
9. Implement every general and team-specific application question listed in the source PDF, including its conditional team flow. Do not silently omit a field or question.
10. Preserve applications after recruitment closes. Closing a drive changes public availability, not the underlying records.

## 2. Source-document findings and decisions to confirm

The PDF contains the application structure detailed in Section 6. Do not silently resolve these source issues:

- The introductory copy says **“three roles”**, but then lists **five teams**. The form likewise lists five. The public copy should be corrected to “five teams” after owner approval.
- Under Branch / Department, the PDF includes **“extract text and gve me”** as option 1. This looks like an accidental instruction, not a department. **Do not expose it as a selectable department unless the recruitment owner explicitly confirms it belongs there.**
- Both **Email** and **College Email Id** are listed. Preserve both as separate fields for now; confirm whether the first is a personal/contact email and the second the institutional email.
- The Design upload prompt says images and “other possible file formats” and sets a 15 MB maximum, but does not define the exact allowed extensions. Configure an explicit allowlist and confirm it with the owner; never accept arbitrary files or executable/script formats.
- The document says “Which Role are you applying for?” singular. Treat this as **single-select** unless the owner confirms multiple role applications are allowed.
- For Marketing, the prompt “If Yes, kindly attach links…” suggests that content links may be conditional on experience. Implement the links field and confirm whether it should appear only after a “Yes” answer or be optional for everyone.
- The PDF does not specify application closing dates, whether applicants can edit/resume a draft, whether an application may be submitted more than once, interview scheduling rules, email provider/templates, retention duration, or whether uploaded files should also be copied into Google Drive. Keep these configurable or confirm them before launch.

## 3. Public website behavior and recruitment state

### 3.1 Persistent recruitment settings

Create a SQL-backed recruitment configuration for each recruitment cycle, including at minimum:

- `cycle_id` / stable cycle identifier, e.g. `2026-27`.
- `title`, e.g. `Coding Club Recruitment 2026–27`.
- `is_open` boolean.
- `opened_at`, `closed_at`, `opened_by`, `closed_by`.
- `announcement_version` or `announcement_updated_at` to determine whether a visitor should see a new announcement.
- Optional `opens_at` / `closes_at` if timed opening and closing are later approved; manual Core Head/Admin control remains the required baseline.

The SQL value is authoritative. Do not keep the actual open/closed state only in React state, local storage, environment variables, or a hardcoded constant. On each server request that needs the public state, read a trustworthy current value from SQL or a safely invalidated cache. A stale cache must not permit submissions while closed.

### 3.2 Navigation visibility

- `is_open = true`: show **Recruitments** in the public navigation and link to the recruitment landing/application flow.
- `is_open = false`: omit the item from the public navigation, including mobile navigation and any footer/menu variants where it is duplicated.
- The admin interface must remain reachable by authorized admins even when recruitment is closed.
- Test both server-rendered and client-rendered navigation states. Avoid a hydration flash where a closed recruitment item briefly appears.
- Hiding the link is UX, **not access control**. Server-rendered pages and all application APIs must independently check `is_open`.

### 3.3 Recruitment-open notification

- When a visitor opens the website and recruitment is open, show a clear, accessible, dismissible announcement (modal or toast/banner based on the site's design system) such as **“Coding Club Recruitment 2026–27 is now open”**, with a button/link to the recruitment page.
- When recruitment is closed, do not render the announcement at all.
- Avoid showing repeated popups on every navigation click. Recommended behavior: show it on the visitor's first page visit in a browser session, store dismissal for that session, and show it again on a later session if recruitment is still open. If the recruitment cycle/announcement version changes, show the updated announcement again.
- The open/close toggle must immediately affect the announcement and navigation. If a cache is used, invalidate it on every state change and keep the maximum stale period short; application submission must always enforce the current state server-side.
- Must work on desktop and mobile, be keyboard accessible, have an obvious close control, avoid trapping focus incorrectly, and respect reduced-motion preferences.

### 3.4 Direct URL behavior

- Closed recruitment landing/application pages should show a clear **Recruitment is currently closed** page or status, not an application form that still submits.
- `POST` endpoints must reject new submissions while closed (e.g. HTTP `403` or `409`, with a user-friendly message).
- Existing applications, review records, and recruitment exports remain accessible to authorized admins after closure.

## 4. Admin controls, permissions, and audit trail

### 4.1 Who can control recruitment

Only authenticated, authorized **Core Heads and Admins** may open or close a recruitment cycle. Verify permissions on the server for every action; never trust a role claim sent by the browser without checking the current user/session and persisted role.

### 4.2 Admin controls

Provide a recruitment management screen with:

- Current cycle name and unmistakable OPEN/CLOSED state.
- Open Recruitment / Close Recruitment action with a confirmation step.
- Who last changed the state and when.
- Applicant count and Google Sheets sync health.
- A visible pending/failed Sheets-sync count and a retry/reconcile action restricted to authorized staff.
- Confirmation that closing recruitment stops new applications but does not erase previous ones.
- Disable or prevent accidental repeated toggles while a state change is in progress.

### 4.3 Audit log

Record security- and workflow-relevant changes, including:

- Recruitment opened/closed: actor ID, timestamp, previous state, new state, cycle ID.
- Application status changes, reviewer assignments, evaluation changes, and exports.
- Sync retry/manual reconciliation actions.
- Permission/role changes relevant to this module.

Audit logs should be append-oriented and readable only by authorized personnel. Never log passwords, authentication tokens, secrets, raw file contents, or unnecessary sensitive response content.

## 5. Suggested application and reviewer workflow

1. Visitor sees recruitment announcement while the cycle is open.
2. Visitor opens Recruitments and reads the intro, teams, and requirements.
3. Applicant completes the common first section.
4. Applicant selects one team; the relevant team-specific question branch is displayed.
5. Validate required fields and formats on the client for usability and **again on the server for security**.
6. Save the completed application to SQL in a transaction and assign a unique application ID/reference.
7. Add a Sheets-sync job to the durable SQL outbox/queue as part of the same transaction.
8. Show success only after the SQL commit succeeds. Show the application reference and a confirmation message; Google Sheets sync can complete asynchronously.
9. Authorized reviewers view/search/filter the applicants and record review status/evaluation.
10. After the cycle closes, no new submissions are accepted; authorized reviewers can finish the process and export results.
11. Selected candidates can eventually be linked to or created as club members, but automatic member creation/offer behavior must be specified before implementation rather than assumed.

### Recommended application statuses

Use a controlled enum/state machine, with names approved by the club. A reasonable starting set is `submitted`, `under_review`, `shortlisted`, `interview_scheduled`, `selected`, `rejected`, `waitlisted`, and `withdrawn`. Record every transition in the audit/history table. Do not let arbitrary client-provided strings change status.

## 6. Application form — complete field inventory from the PDF

Keep question wording and team-specific branching faithful to the PDF. Required/optional flags, character limits, and validation should be documented in a versioned form schema so they can be changed without losing older application data.

### 6.1 Public introduction / common Section 1

Suggested title and intro from the PDF:

- **Coding Club | Recruitment 2026–27**
- **Join the Coding Club!**
- Intro: students interested in technology, creativity, community building, or organising events are invited to join.
- Team descriptions:
  - **Design:** Create engaging visuals and build the club's visual identity.
  - **Marketing:** Promote initiatives, manage outreach, and grow the community.
  - **Events & Operations:** Plan, coordinate, and execute workshops, hackathons, and club events.
  - **Technical Team:** Build projects, solve problems, explore new technologies, and develop innovative technical solutions.
  - **Outreach & Sponsorship Team:** Build industry connections, collaborate with companies and startups, secure sponsorships, and establish strategic partnerships for Coding Club events.
- Closing copy: eagerness to learn, collaborate, take initiative, and make an impact.

Fields listed on page 1:

1. Email.
2. Full Name.
3. College Email Id.
4. Phone Number.
5. USN.
6. Year of Study: 1st year, 2nd year, 3rd year, 4th year.
7. Branch / Department. Options listed in the PDF:
   - Artificial Intelligence and Machine Learning
   - Computer Science and Engineering
   - Computer Science and Business Systems
   - Electronics and Communication Engineering
   - Electrical and Electronics Engineering
   - Mechanical Engineering
   - Plus the suspicious text `extract text and gve me` at the start of the list; see Section 2 and confirm before shipping.

There is a Next button after this section. Preserve a clear next/back flow and avoid discarding responses if the applicant moves between sections.

### 6.2 Shared role-selection section

Heading: **Role Selection**

1. **Which role are you applying for?** Single-select options:
   - Design Team
   - Marketing Team
   - Event & Ops Team
   - Technical Team
   - Outreach & Sponsorship Team
2. **How many clubs or student organisations are you currently a part of? Mention their names and your role in each, if applicable. If none, write N/A.**
3. **Why do you want to join the Coding Club, and what makes you interested in being a part of our team?**
4. **How many hours per week can you realistically dedicate to Coding Club activities, considering your classes, exams, and other commitments?** Options:
   - 1–2 hrs
   - 3–5 hrs
   - 6–8 hrs
   - 9+ hrs

After role selection, show exactly the matching role-specific branch below.

### 6.3 Design Team branch

1. **Have you worked in a design team before?** Yes / No.
2. **Which tools have you used for designing?** Options: Canva; Figma; Adobe Photoshop; Adobe Illustrator; Haven't used any yet; Other (with text field). Support multiple selections. If “Haven't used any yet” is selected, handle incompatible combinations intentionally.
3. **Which of the following have you designed before?** Options: Event posters; Social media posts; Logos or brand identities; Presentations; Merchandise or apparel; Video edits or motion graphics; Personal design projects; None yet, but I'm interested in learning. Support multiple selections and define sensible incompatibility behavior for “None yet”.
4. **Upload one design you've created that best represents your creativity.** Support the PDF's 15 MB maximum. The source says images and “other possible file formats”; implement a reviewed, explicit file-type allowlist. Do not allow arbitrary executable/script files. Store the binary securely, not in a publicly browsable directory.
5. **Upload link of one design you admire, even if you didn't create it. What specifically makes it effective?** Include a URL field and explanation field.
6. **Name one brand, designer, or creative account whose visual style you like. What do you like about their work?**
7. **Where do you usually find inspiration for your designs?**
8. **How do you use AI tools in your design process, and which tools have you used?**
9. **How would you maintain a consistent visual identity across posters, ID cards, and merchandise?**
10. **You have limited time to finish a poster, an Instagram post, and an ID card. How would you prioritise and manage the work?**
11. **What interests you about joining the Coding Club's Design Team, what do you hope to gain from the experience, and how would you contribute to the team?**

### 6.4 Marketing Team branch

1. **Which areas of marketing interest you?** Options: Social media management; Content writing and captions; Branding and promotions; Community growth; Other (with text field). Support multiple selections.
2. **What platforms do you use for content creation/marketing?**
3. **Do you have any experience in marketing/content creation? Explain in 50 words.** Enforce the 50-word limit server-side as well as in the UI.
4. **If Yes, kindly attach links to videos of your previous content creation and marketing projects.** Include a URL/list field. Confirm whether this is conditional on a separate experience Yes/No choice or simply an optional field, because no explicit Yes/No control is listed in the PDF.
5. **What makes you think you should join the MARKETING team specifically?**
6. **Imagine we are hosting a hackathon. How would you promote it to increase registrations?**
7. **What's one thing you'd change or improve about how the coding club currently operates or promotes itself?**

### 6.5 Event & Operations Team branch

1. **Imagine you are managing the registration desk for our flagship hackathon. Fifteen minutes before kickoff, the main Wi-Fi network crashes, and 200 participants are waiting outside. What is your immediate, step-by-step plan to handle the situation?**
2. **Coding Club workshops often start with high attendance, but participation drops after a few sessions. Propose one creative, low-budget initiative to keep students consistently engaged and attending our workshops and events.**
3. **College life involves balancing exams, assignments, and club events. Describe a time you faced conflicting priorities. How did you organise your time, and how did you respond when things didn't go as planned?**
4. **You are paired with a team member who has stopped responding to messages and hasn't completed their assigned event tasks, just 48 hours before the event. How would you handle the situation constructively?**
5. **Imagine a high-stakes club deadline is just 24 hours away. Your assigned tasks are complete, but another department, such as Tech, Design, or Marketing, is severely short-staffed, threatening the project's success. You have no prior experience in their domain. How would you respond, and what steps would you take to help the team deliver successfully?**
6. **Why do you want to join the Events & Operations Team specifically, rather than the Technical or Design Team? What is one unique event idea you'd love to bring to the Coding Club this year?**

### 6.6 Technical Team branch

1. **Which technical domains are you interested in or have experience with?** Options: Data Structures & Algorithms (DSA); Web Development; App Development; AI / Machine Learning; Blockchain / Web3; Cybersecurity; Cloud Computing / DevOps; UI/UX and Frontend Development; Beginner – eager to learn; Other (with text field). Support multiple selections and define sensible incompatibility behavior for “Beginner” if needed.
2. **Share your GitHub profile URL. If you don't have one, write N/A.**
3. **Share your portfolio or personal website URL, if available. Otherwise, write N/A.**
4. **If you're interested in Data Structures & Algorithms (DSA), share your coding profiles. Include platforms such as: LeetCode, Codeforces, CodeChef, GeeksforGeeks, HackerRank.** Make this field clear and optional when DSA is not selected.
5. **Tell us about the technical projects you've built or contributed to. Mention the problem, technologies used, and your role. If you haven't built any projects yet, what would you like to build?**
6. **Describe a technical challenge you faced while building a project or solving a coding problem. How did you approach it?**
7. **Why do you want to join the Coding Club's Technical Team, and what would you like to contribute?**

### 6.7 Outreach & Sponsorship Team branch

1. **Have you previously worked in outreach, corporate relations, sponsorships, or partnerships? If yes, briefly describe your experience and contributions. If not, write N/A.**
2. **Suppose our upcoming hackathon needs a sponsor. How would you identify suitable companies and approach them to secure sponsorship?**
3. **Imagine a company hasn't responded to your sponsorship email after a week. What would you do next?**
4. **Your task is to contact tech companies and startups and help secure at least one sponsor for an upcoming Coding Club event. How would you plan and execute this task?**
5. **Why do you want to join the Outreach & Sponsorship Team, and what skills or strengths would make you suitable for this role?**

## 7. Data architecture and durable SQL storage

Use the existing application's database and conventions where practical; confirm the actual ORM/database before coding. Keep the design compatible with the existing Next.js/PostgreSQL platform described by the project owner.

### 7.1 Suggested entities/tables

Names can adapt to the existing schema, but these responsibilities must exist:

- **`recruitment_cycles`**: cycle ID, title, status/open flag, open/close audit fields, schema/version identifiers, timestamps.
- **`applications`**: immutable unique application ID, cycle ID, submission timestamp, applicant identity/contact fields, USN, year, branch, selected team, weekly availability, status, form version, created/updated timestamps, and optional idempotency key.
- **`application_responses`** or equivalent JSONB payload: all common and role-specific responses keyed by stable field IDs, with a schema version. Avoid throwing away unknown/new fields during future form edits. A hybrid structured-column + JSONB approach is acceptable if data integrity is maintained.
- **`application_files`**: application ID, original filename (sanitized), detected MIME type, size, private storage key, checksum, scan status, upload timestamp, and retention/deletion status. Do not store public, guessable URLs for private files.
- **`application_status_history`**: old/new status, actor, timestamp, and optional reason.
- **`review_assignments`**: application, reviewer, assignment metadata.
- **`application_reviews`**: reviewer ID, rubric/score, structured feedback, private notes, timestamp and version/history.
- **`recruitment_audit_log`**: recruitment state changes, reviewer/admin actions, exports, sync operations and permission changes.
- **`sheets_sync_outbox`**: durable record of each SQL change to be synced, retry count, next attempt, state, error category, created/updated/synced timestamps, and idempotency key.
- **`recruitment_settings`** if not stored on `recruitment_cycles`: validated, SQL-backed configuration values.

Use foreign keys, indexes, appropriate constraints, migrations, and transactions. Index common admin filters (cycle, submitted time, selected role/team, status, year, branch, USN/email where appropriate). Avoid indexing or exposing large free-text answers unnecessarily.

### 7.2 Data integrity and privacy

- Use stable internal application IDs; do not use USN, email or phone number as the record's primary key.
- Normalize email addresses for duplicate checks, but preserve the user's input as needed. Do not assume email alone identifies a valid student.
- Decide duplicate policy: prevent accidental double-click/retry duplicates with idempotency; define whether a student may deliberately submit a replacement or multiple applications. Until approved, default to one active submission per cycle per normalized college email/USN, with an admin-reviewed correction/replacement path.
- Store and display USN, phone number, contact emails, application responses, and reviewer feedback only for legitimate recruitment purposes and only to authorized roles.
- Never log complete form payloads, secrets, session cookies, access tokens or uploaded binary contents.
- Use stable form field IDs; changing visible question wording later must not shift data into the wrong column or lose old submissions.

## 8. Google Sheets backup — single consolidated workbook

### 8.1 Workbook layout

Create or configure one Google Spreadsheet for the `2026–27` recruitment cycle. Do not create separate team-owned spreadsheets as independent sources.

Recommended tabs:

1. **`Applications`** — the canonical flat backup/export: exactly one row per application, with application ID, cycle ID, submitted/updated timestamps, current status, team, all common fields, all team-specific answers in stable named columns, file metadata/private links, form/schema version, and sync timestamp. Fields irrelevant to another team's branch stay blank, not lost.
2. **`Sync Health`** — last successful sync, last error, pending count and reconciliation counts. Restrict access to admins.
3. **Optional derived team views** — only if useful, and preferably Google Sheets filter views over `Applications`. Do not make separate tabs/spreadsheets the only copy of team data. If dedicated team tabs are approved later, generate them from the canonical tab and never treat them as separate sources of truth.

Set a stable column mapping and include schema/form version. Keep column headers machine-stable even if the display labels change. Protect header/configuration areas and limit spreadsheet sharing to the designated admin group/service identities. Avoid `Anyone with the link` access.

### 8.2 Safe and reliable synchronization

**Required pattern: SQL first, async sync second.**

1. Validate the submission and commit the application and a sync-outbox event in the same SQL transaction.
2. Return success only after the SQL transaction commits.
3. A worker/background job reads pending outbox records and upserts the row in the canonical `Applications` sheet using the stable `application_id` as the lookup/idempotency key.
4. Mark a queue item synced only after a confirmed Sheets API success. Store last attempt, attempts, result and timestamp.
5. Retry transient network errors, timeouts, HTTP 429/quota errors and recoverable 5xx errors with exponential backoff and jitter; cap attempts per run but retain failed items for later/manual recovery. Do not silently discard or permanently dead-letter a record without admin visibility.
6. Make sync idempotent: retries or worker restarts must update the same application row, never append duplicate rows.
7. A periodic reconciliation process compares SQL application IDs/updated timestamps with the Sheet. Identify missing rows, stale rows, duplicate rows and unexpected sheet entries; repair SQL-to-Sheet missing/stale records using SQL as authority and produce an audit event.
8. Admin dashboard should show SQL save success separately from Sheets sync status. A Sheets outage must not show the user a false failed submission if SQL saved successfully.
9. Use the Google Sheets API with credentials stored server-side in environment/secret management. A restricted service account or approved OAuth identity should have access only to this recruitment workbook. Never expose its credentials in frontend code or commit them to Git.
10. Account for API quota/rate limits with batching where appropriate, bounded concurrency, retry-after handling, and a monitored worker. Do not let spreadsheet work run synchronously on the form request path.

### 8.3 What the Sheet can and cannot back up

Google Sheets can preserve structured text answers and file references/metadata; it cannot contain the actual uploaded binary file as a normal cell. Therefore:

- SQL stores file metadata and a private storage key/reference.
- Upload files must be stored in a private durable location and backed up independently (see Section 9). A private Google Drive copy may be added if approved, but it is not implied by the PDF.
- The Sheet may include a protected link/reference only if access is restricted and the link does not grant public access.
- If a submission includes a file, consider it fully protected only when the file itself is backed up and its checksum can be verified—not merely because its row exists in Sheets.

### 8.4 Backups and recovery targets

- Configure automated SQL database backups and retain them according to an owner-approved schedule. Keep backups outside the same failure domain as the live database.
- Encrypt backups at rest and restrict access. Verify that database restore works in a non-production environment on a schedule.
- Back up uploaded files and preserve the mapping from SQL file metadata to stored content.
- Document restore order: database + file storage, then reconcile/repopulate the Google Sheet from SQL.
- Define and record RPO/RTO (acceptable data-loss window and recovery time) before launch. Minimum expectation: a confirmed SQL save survives a web process crash and a transient Sheets outage.
- The Google Sheet is an additional recovery/export layer, not a substitute for database backups or point-in-time recovery.

## 9. Secure design and upload handling

### 9.1 File upload requirements

- Maximum file size: **15 MB per uploaded design**, as stated in the PDF. Confirm whether the limit is per file or total per application; the PDF implies one uploaded design, with a 15 MB maximum.
- Enforce limits at reverse proxy/hosting layer, application server, and storage layer.
- Configure explicit extension and MIME allowlists approved for design work. Verify detected content rather than trusting a client-provided filename or `Content-Type` header. Reject executables, scripts, HTML payloads, macro-enabled office files, path traversal names, and unsupported formats.
- Sanitize filenames; generate an opaque storage key. Do not use a user-provided filename as a path.
- Store uploads outside the public web root or in private object storage. Access only through an authenticated, authorized download route or short-lived signed URL. Check reviewer permission on every download.
- Do not execute or render uploaded files in the server environment. Serve risky formats as downloads with safe content-disposition and content-type headers. Sanitize or disallow active formats such as SVG unless a safe handling policy is implemented.
- Scan uploads for malware if an appropriate scanning service is available; mark scan status and do not expose quarantined files to reviewers.
- Validate file size and type before expensive processing; use random IDs, per-application quotas, timeouts and storage quotas. Prevent zip bombs or nested archive abuse by not accepting archives unless explicitly required.
- Store upload checksums; back up files and periodically verify checksum/integrity.

### 9.2 Application/API security

- Server-side schema validation for all fields, enumerated options and conditional branches. Trim inputs and define safe length limits. Treat all free text and URLs as untrusted.
- Parameterized SQL/ORM queries only; no string-built SQL.
- Apply correct authentication/session controls to admin routes, secure cookies (`HttpOnly`, `Secure`, suitable `SameSite`), session expiration and invalidation, and CSRF protection where cookie-authenticated state-changing routes require it.
- Enforce authorization on every server action/API, not only by hiding buttons or routes in the frontend. Use least privilege (Core Head/Admin, reviewer/coordinator, applicant, anonymous visitor).
- Use a modern password/authentication policy through the existing auth system; never store plaintext passwords. Consider MFA for privileged admins if supported.
- Set security headers including a reviewed Content Security Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, frame protection through CSP `frame-ancestors`, and an appropriate `Permissions-Policy`. Enforce HTTPS.
- Avoid open redirects and unsafe URL fetching. Validate URL protocols for portfolio/design links; allow `https` and optionally `http` where needed, and never fetch arbitrary applicant URLs from the server.
- Escape output to prevent stored/reflected XSS in responses, reviewer notes, filenames and spreadsheet cells. Protect Sheets exports against formula injection: text starting with `=`, `+`, `-`, or `@` must be safely escaped/encoded as literal text.
- Keep dependencies patched, run dependency and secret scans, and do not commit API keys, service-account JSON, private keys or production `.env` files.
- Add robust error handling and generic public errors; never reveal SQL errors, stack traces, secrets or filesystem paths to visitors.

### 9.3 Rate limiting and abuse prevention — mandatory

Implement rate limiting on the server/edge, not only in the browser. Choose a shared store suitable for multiple app instances (e.g. Redis/managed KV or an atomic SQL strategy); per-process in-memory limits alone are insufficient.

At minimum, apply configurable per-IP and/or per-session/per-account limits to:

- Application creation/submission endpoint.
- Draft/save/edit endpoints if drafts are supported.
- Upload initiation and upload bytes; cap file count, size, and total per application.
- Login, password reset, OTP/email verification, and other authentication routes used by the platform.
- Admin open/close toggle, export/download routes, review/status mutation routes, and Sheets retry/reconciliation actions.
- Any public endpoint that can trigger expensive computation, send email, write data, or make external API calls.

Requirements:

- Use stricter limits for login and privileged actions; use reasonable limits for real applicants so shared campus Wi-Fi does not lock out an entire lab/class. Pair IP limits with session/account/email/USN-based controls and idempotency keys where appropriate.
- Return HTTP `429 Too Many Requests` with a clear retry policy/`Retry-After` where applicable. Log counters and rate-limit events without logging sensitive form content.
- Add a honeypot and/or proof-of-work/CAPTCHA/risk challenge only where appropriate and accessible; do not rely on CAPTCHA as the only defense. Consider CSRF, origin checks and bot detection for public submission.
- Configure request/body size limits, timeouts, concurrency limits, and database connection pooling. Protect against submission floods, upload floods, brute-force login and costly export/sync abuse.
- Add edge/WAF protections if available (e.g. Cloudflare WAF/bot rules), but maintain application-level controls even if the edge is bypassed.
- Use atomic duplicate/idempotency checks to handle double clicks, browser retries and replayed requests. Do not let a client reset its own quotas by changing a simple browser variable.
- Monitor repeated 4xx/429/5xx spikes, unexpected request volumes, storage growth, SQL pool saturation and expensive queries. Define an incident response/contact path.
- Test with controlled, authorized load/security tests against staging or an explicitly approved target. Never stress-test production without a reviewed safe test plan.

## 10. Reviewer/admin experience

The admin interface should include:

- Application table with server-side pagination, sorting and filters for cycle, team, status, year, branch, and submitted date.
- Search on permitted identifiers such as name, email and USN, with access controls and query throttling.
- Application detail page showing the common section and only the relevant team-specific answers, uploaded file(s), status history, and review information.
- Clear distinctions between applicant-provided answers and internal reviewer notes.
- Team/reviewer assignment and status-transition controls; all changes audited.
- Optional standardized scorecard/rubric per team. The PDF does not define scoring criteria, so these must be supplied by the recruitment owners before scorecards are implemented.
- CSV export only for authorized users, logged and rate-limited. Escape formula-like cell contents on export.
- A status/sync dashboard: number of submissions in SQL, number in Sheets, pending and failed sync records, latest successful sync, last reconciliation, and a controlled retry action.
- No requirement to use Google Sheets as the day-to-day database or to edit live submissions in the Sheet. Corrections should be made through the application/admin interface and then synced outward.

## 11. Notifications and emails

Required by the user's stated behavior: the website announcement when recruitment is open. The PDF does not define email notifications; treat email as an optional workstream requiring confirmation.

If enabled, design templates for application receipt, interview invitation, status changes and final outcome; use a verified sender, handle delivery failures, avoid leaking candidate data between recipients, and log delivery status without storing unnecessary message secrets. Never make email delivery a condition for the SQL application save.

## 12. Observability and incident response

- Structured server logs with request/correlation ID, endpoint, status, duration, user/role where applicable, and safe error categories.
- Metrics for successful/failed SQL writes, submission rate, rate-limit triggers, upload rejects, authentication failures, latency, database saturation, sync queue age/size, Sheets API errors/quota responses, and backup/restore job outcomes.
- Alert on sustained sync backlog, repeated sync failures, backup failures, database/storage threshold alarms, and unusual submission surges.
- Document how admins pause recruitment, rotate credentials, revoke a compromised Sheets service identity, restore data, replay sync records and communicate during an incident.
- Ensure a Sheets credential failure cannot disable application saves or expose data. Keep secrets rotatable.

## 13. Implementation phases and deliverables

### Phase 0 — Audit and decisions

- Inspect the current site structure, auth/role model, database schema/ORM, hosting/deployment, Cloudflare/WAF configuration, current backup practices and existing admin layout.
- Confirm the questions in Section 16; verify branch options, email meaning, role-selection cardinality, upload allowlist and duplicate-submission policy.
- Freeze a versioned form-field inventory and a Google Sheets column map.
- **Deliverable:** approved technical design, data map, threat model, and launch checklist.

### Phase 1 — SQL model and migrations

- Add recruitment cycle/config, application, response, file metadata, status history, review, audit, and Sheets outbox structures as appropriate to existing schema.
- Add constraints/indexes, unique/idempotency rules and migration rollback notes.
- Seed the 2026–27 recruitment cycle as closed until explicitly opened by an authorized user.
- **Deliverable:** migrations, schema documentation, automated migration tests.

### Phase 2 — Public recruitment UI and conditional form

- Add conditional navbar entry and recruitment landing page.
- Add recruitment-open notification and dismissal/version behavior.
- Build common fields and all five team-specific branches from Section 6; preserve applicant responses across Next/Back and branch changes.
- Implement validation, accessible errors, mobile/responsive UI, upload feedback and final review/confirmation screen.
- **Deliverable:** end-to-end applicant flow behind the SQL open/closed state.

### Phase 3 — Submission API and uploads

- Implement server-side open-state check, validation, idempotency/duplicate handling, SQL transaction and unique application ID.
- Implement private upload storage, type/size checks, malware-scan hook if available, authorization-checked downloads and independent file backups.
- Ensure the response is reported successful only after SQL commit.
- **Deliverable:** secure submission and file-handling APIs with integration tests.

### Phase 4 — Google Sheets synchronization and recovery

- Provision the single consolidated workbook and least-privilege credentials.
- Implement transactional outbox, background worker, stable column mapping, idempotent upsert, retry/backoff, status metrics and reconciliation.
- Implement authorized retry and SQL-to-Sheet recovery/rebuild.
- Test the flow while Sheets credentials are invalid, quota is exhausted, and network calls time out; confirm applications still save in SQL and sync later.
- **Deliverable:** reliable SQL-to-Sheets backup pipeline and documented recovery procedure.

### Phase 5 — Admin and reviewer dashboard

- Implement recruitment toggles for Core Heads/Admins, state confirmation, audit history and strict server authorization.
- Implement applicant list/detail, filters, pagination, status workflow, reviewer access, audit history and protected exports.
- Display SQL-vs-Sheets sync health and unresolved failures.
- **Deliverable:** operational recruitment control and review dashboard.

### Phase 6 — Security hardening

- Configure distributed rate limits and WAF/edge rules where available.
- Validate CSRF/origin protections, secure sessions, role enforcement, security headers, upload protections, formula injection prevention and secret management.
- Run dependency/secret scans and authorized staging tests including request floods, upload limits, duplicate/replay submissions, unauthenticated admin access, bypassed closed-state routes and SQL/Sheets outage scenarios.
- **Deliverable:** security checklist with test evidence and no known critical/high-severity blockers.

### Phase 7 — Backups, load testing and release

- Configure automated SQL and uploaded-file backups, retention, encryption, restore rehearsal and sheet reconciliation.
- Load test the full form and admin list on staging with realistic expected traffic; measure p95/p99 latency, error rate, queue delay and DB saturation. Use approved thresholds based on the hosting budget and expected recruitment volume.
- Verify deployment environment variables/secrets, migrations, health checks, logs, rollback plan and admin permissions.
- Soft-launch to a small test group, then authorize Core Heads/Admins to open recruitment.
- **Deliverable:** signed release checklist, verified restore evidence and operational handover notes.

## 14. Testing matrix — release blockers

### Public behavior

- [ ] Closed cycle: Recruitments navbar item absent across desktop/mobile; no recruitment-open notification.
- [ ] Closed cycle: direct recruitment URL shows closed state; submission API rejects new applications.
- [ ] Open cycle: navbar item appears; announcement appears to a new visitor; announcement links correctly; dismissal works as specified.
- [ ] Reopening or updating the announcement causes the intended new-visit behavior without stale cached state.
- [ ] Open/close state stays correct after server restart, deployment, cache revalidation and across multiple app instances.

### Form correctness

- [ ] Every common field and each of the five team-specific branches matches Section 6.
- [ ] Role branching shows only the selected team's questions and persists data on navigation.
- [ ] All option lists and word/file limits are tested, including “Other” fields and selections with “None yet” / “Beginner”.
- [ ] Missing, malformed, oversized and unexpected fields are rejected server-side.
- [ ] Keyboard navigation, screen-reader labels, mobile layout and accessible error messages work.
- [ ] Duplicate click/retry does not create duplicate rows; intentional replacement follows the approved policy.

### SQL and recovery

- [ ] Successful UI confirmation corresponds to a committed SQL record.
- [ ] Rollback occurs cleanly if the SQL transaction fails; no false success is shown.
- [ ] Application and outbox event commit atomically.
- [ ] Database backup is restorable; restored data is consistent and retains application IDs/status history.
- [ ] Uploaded files are backed up, restore correctly and match stored checksums.

### Google Sheets

- [ ] Every role appears in the same canonical workbook/tab.
- [ ] Upsert creates one row per application; retry/restart updates rather than duplicates.
- [ ] Outage, invalid credentials, 429/quota and 5xx failures stay visible and retry later.
- [ ] The site continues to accept valid applications while Sheets is unavailable, provided SQL is healthy.
- [ ] Reconciliation finds and repairs missing/stale rows; it does not overwrite SQL from a manually edited Sheet.
- [ ] Formula-injection strings remain inert text; sharing is restricted; credentials are absent from client bundles/logs.
- [ ] Sheets can be rebuilt from SQL after a simulated deletion/corruption.

### Security and reliability

- [ ] Anonymous user cannot open/close recruitment, access reviewer pages, export applications or download private uploads.
- [ ] Non-admin reviewer cannot perform Core Head/Admin-only actions.
- [ ] Every privileged action is authorized server-side and audited.
- [ ] Rate limits trigger as intended on submissions, uploads, authentication and admin operations.
- [ ] Rate limiter works across multiple instances and behaves reasonably on shared campus Wi-Fi.
- [ ] Payload size, request timeout, database pool and upload quota limits are in place.
- [ ] Upload spoofing, traversal, forbidden extensions, malicious test files and direct unauthenticated file URLs are rejected.
- [ ] Stored/reflected XSS, CSRF (where applicable), SQL injection, open redirect and privilege-escalation tests pass.
- [ ] Security headers, HTTPS, secret scanning, dependency scanning and error redaction are verified.
- [ ] Admin dashboard alerts when sync or backups fail; recovery/runbook steps are tested.

## 15. Definition of done

Recruitment is **not ready to open** until all of the following are true:

- The Core Heads/Admins can safely open and close the correct cycle.
- Navbar, public routes, announcement and submission API all agree on the live state.
- All five recruitment branches and all questions from the PDF have been implemented and verified.
- SQL is the guaranteed primary save; Google Sheets is an asynchronous, consolidated and reconcilable secondary copy.
- Upload bytes—not only their links—have an approved secure storage and backup plan.
- Rate limiting, authorization, safe uploads, security headers, validation, abuse monitoring and audit logs are active.
- Database and file backup restoration have been demonstrated, and the Sheet can be rebuilt/reconciled from SQL.
- The testing matrix has passing evidence and no unresolved critical/high-severity security issues.
- The owner has approved the copy/field ambiguities and the production workbook/access permissions.

## 16. Owner decisions needed before or during implementation

Do not block foundational development unnecessarily, but resolve these before opening recruitment:

1. Confirm the suspicious Branch / Department option `extract text and gve me` should be removed; confirm the final department list.
2. Confirm whether `Email` is a personal email and `College Email Id` is the institutional email.
3. Confirm one team per application (recommended default) or multiple team preferences.
4. Confirm the exact allowed design upload formats; PDF size limit is 15 MB. Confirm whether the limit is per file and whether additional files are ever allowed.
5. Confirm duplicate/resubmission policy, and whether applicants can save drafts/edit after submitting.
6. Confirm whether Marketing portfolio links appear conditionally on an experience answer or remain optional for all applicants.
7. Confirm who is included in the “Core Heads” permission group and whether team coordinators/reviewers have limited review permissions.
8. Confirm Google account/service identity and access list for the single backup workbook, plus who owns it if the original admin graduates/leaves.
9. Approve database/file backup retention, RPO/RTO, and who is responsible for periodic restore tests.
10. Confirm recruitment deadline and whether the cycle has scheduled open/close timestamps in addition to manual toggles.
11. Confirm whether email receipts/status updates and interview scheduling are in scope; neither is fully defined by the PDF.
12. Provide scoring rubrics, round names, reviewer assignment rules and final selection policy if they are to be part of the platform.
13. Confirm hosting/runtime constraints and available Redis/KV or managed rate-limit service; implement a shared atomic limiter suitable for the real deployment.
14. Confirm whether private uploads should additionally be copied to restricted Google Drive. A Google Sheet alone cannot back up the binary contents.

## 17. Suggested project file organization

Adapt this to the existing codebase rather than forcing a new structure:

```text
recruitment/
  schema/                 # Versioned form schema and stable field IDs
  validation/             # Shared client/server schema validation
  services/               # Application, cycle state, review and sync services
  permissions/            # Server-side authorization policies
  sheets/                 # Column mapper, worker, upsert and reconciliation
  uploads/                # Type/size policy and private storage adapter
  rate-limit/             # Shared atomic rate-limit policies
  audit/                  # Audit logging helpers
  tests/
    unit/
    integration/
    security/
    e2e/
```

This is a logical map, not a requirement to create these exact folders. Keep environment-specific logic, secrets and provider details out of public/frontend bundles.

---

**Implementation priority:** build the SQL-backed open/closed control and data model first; complete the form from the inventory; then make reliable SQL-first submission and Sheets sync work; only then open the cycle after security, backup/restore and acceptance tests pass.
