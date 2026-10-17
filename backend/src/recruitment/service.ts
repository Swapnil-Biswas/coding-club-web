// Recruitment service — all business logic (no Express, no HTTP).
// Uses better-sqlite3 synchronous API to match the rest of the codebase.

import crypto from 'node:crypto';
import { db, getOne, getAll, runQuery } from '../db.js';
import { HttpError } from '../lib/errors.js';
import type { ActorLike } from '../lib/types.js';
import {
  validateCommonFields,
  extractCommonFields,
  validateTeamResponses,
  validateStatusTransition,
  sanitizeForSheets,
} from './validation.js';
import {
  ALLOWED_STATUSES,
  type ApplicationRow,
  type ApplicationStatus,
  type PublicApplication,
  type PublicRecruitmentState,
  type AdminApplicationSummary,
  type SyncHealthSummary,
  type RecruitmentTeam,
  type StatusHistoryRow,
  type ApplicationFileRow,
  type PublicApplicationFile,
  type PublicStatusHistory,
} from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newUuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function canManageRecruitment(actor: ActorLike): boolean {
  return actor.role === 'core_head' || actor.role === 'admin';
}

function canReviewApplications(actor: ActorLike): boolean {
  return actor.role === 'core' || actor.role === 'core_head' || actor.role === 'admin';
}

function auditLog(
  cycleId: string | null,
  actorId: number | null,
  action: string,
  entity: string,
  entityId: string,
  details: Record<string, unknown> = {},
): void {
  try {
    runQuery(
      `INSERT INTO recruitment_audit_log (cycle_id, actor_id, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cycleId, actorId, action, entity, entityId, JSON.stringify(details)],
    );
  } catch (e) {
    console.error('[recruitment] audit log write failed', e);
  }
}

// ─── Public state (anyone can read) ──────────────────────────────────────────

export function getRecruitmentState(): PublicRecruitmentState | null {
  const row = getOne<{
    id: string; title: string; is_open: number;
    announcement_version: number;
  }>(
    `SELECT id, title, is_open, announcement_version
     FROM recruitment_cycles ORDER BY created_at DESC LIMIT 1`,
  );
  if (!row) return null;
  return {
    is_open: Boolean(row.is_open),
    cycle_id: row.id,
    title: row.title,
    announcement_version: row.announcement_version,
  };
}

// ─── Admin: open / close cycle ────────────────────────────────────────────────

export function openRecruitment(actor: ActorLike, cycleId = '2026-27'): void {
  if (!canManageRecruitment(actor)) throw new HttpError(403, 'forbidden');

  const cycle = getOne<{ id: string; is_open: number }>(
    `SELECT id, is_open FROM recruitment_cycles WHERE id = ?`, [cycleId],
  );
  if (!cycle) throw new HttpError(404, 'recruitment cycle not found');
  if (cycle.is_open) throw new HttpError(409, 'recruitment is already open');

  const ts = now();
  const tx = db.transaction(() => {
    runQuery(
      `UPDATE recruitment_cycles
       SET is_open = 1, opened_at = ?, opened_by = ?,
           announcement_version = announcement_version + 1,
           updated_at = ?
       WHERE id = ?`,
      [ts, actor.id, ts, cycleId],
    );
    auditLog(cycleId, actor.id as number, 'cycle_opened', 'cycle', cycleId, {
      opened_by_name: actor.name,
    });
  });
  tx();
}

export function closeRecruitment(actor: ActorLike, cycleId = '2026-27'): void {
  if (!canManageRecruitment(actor)) throw new HttpError(403, 'forbidden');

  const cycle = getOne<{ id: string; is_open: number }>(
    `SELECT id, is_open FROM recruitment_cycles WHERE id = ?`, [cycleId],
  );
  if (!cycle) throw new HttpError(404, 'recruitment cycle not found');
  if (!cycle.is_open) throw new HttpError(409, 'recruitment is already closed');

  const ts = now();
  const tx = db.transaction(() => {
    runQuery(
      `UPDATE recruitment_cycles
       SET is_open = 0, closed_at = ?, closed_by = ?, updated_at = ?
       WHERE id = ?`,
      [ts, actor.id, ts, cycleId],
    );
    auditLog(cycleId, actor.id as number, 'cycle_closed', 'cycle', cycleId, {
      closed_by_name: actor.name,
    });
  });
  tx();
}

export function getAdminCycleDetail(actor: ActorLike, cycleId = '2026-27') {
  if (!canManageRecruitment(actor)) throw new HttpError(403, 'forbidden');
  const cycle = getOne<{
    id: string; title: string; is_open: number;
    opened_at: string | null; closed_at: string | null;
    opened_by: number | null; closed_by: number | null;
    announcement_version: number;
    opened_by_name?: string | null;
    closed_by_name?: string | null;
  }>(`
    SELECT rc.*,
           opener.name AS opened_by_name,
           closer.name AS closed_by_name
    FROM recruitment_cycles rc
    LEFT JOIN users opener ON opener.id = rc.opened_by
    LEFT JOIN users closer ON closer.id = rc.closed_by
    WHERE rc.id = ?
  `, [cycleId]);
  if (!cycle) throw new HttpError(404, 'cycle not found');

  const stats = getOne<{
    total: number; submitted: number; under_review: number;
    shortlisted: number; selected: number;
  }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
      SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) AS under_review,
      SUM(CASE WHEN status = 'shortlisted' THEN 1 ELSE 0 END) AS shortlisted,
      SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) AS selected
    FROM recruitment_applications WHERE cycle_id = ?
  `, [cycleId]);

  const syncHealth = getSyncHealth();

  return {
    cycle: { ...cycle, is_open: Boolean(cycle.is_open) },
    stats: stats ?? { total: 0, submitted: 0, under_review: 0, shortlisted: 0, selected: 0 },
    sync_health: syncHealth,
  };
}

// ─── Submit application ───────────────────────────────────────────────────────

interface SubmitApplicationInput {
  body: Record<string, unknown>;
  fileKey?: string;        // private storage key if a file was uploaded
  fileId?: string;         // UUID assigned to file
  fileMeta?: {
    original_name: string;
    mime_type: string;
    size_bytes: number;
    checksum_sha256: string;
  };
}

export function submitApplication(input: SubmitApplicationInput): { application_id: string; reference: string } {
  // 1. Check cycle open state
  const cycle = getOne<{ id: string; is_open: number }>(
    `SELECT id, is_open FROM recruitment_cycles ORDER BY created_at DESC LIMIT 1`,
  );
  if (!cycle || !cycle.is_open) {
    throw new HttpError(403, 'Recruitment is currently closed. Applications are not being accepted.');
  }

  const { body } = input;

  // 2. Validate common fields
  const commonResult = validateCommonFields(body);
  if (!commonResult.ok) throw new HttpError(400, commonResult.error, { field: commonResult.field });

  const common = extractCommonFields(body);

  // 3. Validate team-specific responses
  const teamResponses = (body.team_responses as Record<string, unknown>) ??
    extractTeamResponses(body, common.selected_team);

  const teamResult = validateTeamResponses(common.selected_team, teamResponses);
  if (!teamResult.ok) throw new HttpError(400, teamResult.error, { field: teamResult.field });

  // 4. Idempotency key (client may send one; if not, generate from email+cycle)
  const idempotencyKey = typeof body.idempotency_key === 'string' && body.idempotency_key.trim()
    ? body.idempotency_key.trim().slice(0, 128)
    : `${cycle.id}:${common.college_email}`;

  // 5. Duplicate check (one active submission per cycle per college email)
  const existing = getOne<{ id: string; idempotency_key: string | null }>(
    `SELECT id, idempotency_key FROM recruitment_applications
     WHERE cycle_id = ? AND college_email = ? AND status != 'withdrawn'`,
    [cycle.id, common.college_email],
  );
  if (existing) {
    // If same idempotency key, return the existing ID (idempotent retry)
    if (existing.idempotency_key === idempotencyKey) {
      return { application_id: existing.id, reference: existing.id.slice(0, 8).toUpperCase() };
    }
    throw new HttpError(409, 'An application from this college email already exists for this cycle.');
  }

  const applicationId = newUuid();
  const ts = now();

  // 6. Sanitize team responses against formula injection
  const sanitizedResponses = sanitizeResponses(teamResponses);

  // 7. Commit application + outbox in one transaction
  const tx = db.transaction(() => {
    runQuery(`
      INSERT INTO recruitment_applications
        (id, cycle_id, idempotency_key, status, email, college_email, full_name,
         phone, usn, year_of_study, branch, selected_team, clubs_orgs, why_join,
         weekly_hours, team_responses, form_version, submitted_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      applicationId, cycle.id, idempotencyKey, 'submitted',
      common.email, common.college_email, common.full_name,
      common.phone, common.usn, common.year_of_study, common.branch,
      common.selected_team, common.clubs_orgs, common.why_join,
      common.weekly_hours, JSON.stringify(sanitizedResponses),
      '1.0', ts, ts,
    ]);

    // File record if upload exists
    if (input.fileKey && input.fileId && input.fileMeta) {
      runQuery(`
        INSERT INTO recruitment_application_files
          (id, application_id, field_id, original_name, mime_type, size_bytes,
           storage_key, checksum_sha256, scan_status, uploaded_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `, [
        input.fileId, applicationId, 'design_upload',
        input.fileMeta.original_name, input.fileMeta.mime_type,
        input.fileMeta.size_bytes, input.fileKey,
        input.fileMeta.checksum_sha256, 'pending', ts,
      ]);
    }

    // Outbox for Sheets sync
    runQuery(`
      INSERT INTO recruitment_sheets_outbox
        (application_id, idempotency_key, state, next_attempt_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `, [applicationId, `sync:${applicationId}`, 'pending', ts, ts, ts]);

    // Audit
    auditLog(cycle.id, null, 'application_submitted', 'application', applicationId, {
      team: common.selected_team,
      year: common.year_of_study,
    });
  });
  tx();

  return {
    application_id: applicationId,
    reference: applicationId.slice(0, 8).toUpperCase(),
  };
}

// Extract team-specific fields from a flat body (frontend sends nested object)
function extractTeamResponses(
  body: Record<string, unknown>,
  _team: RecruitmentTeam,
): Record<string, unknown> {
  // Frontend sends team_responses as a nested object
  if (body.team_responses && typeof body.team_responses === 'object') {
    return body.team_responses as Record<string, unknown>;
  }
  return {};
}

function sanitizeResponses(responses: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(responses)) {
    if (typeof v === 'string') {
      out[k] = sanitizeForSheets(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) => (typeof item === 'string' ? sanitizeForSheets(item) : item));
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Admin: list applications ─────────────────────────────────────────────────

interface ListApplicationsOptions {
  cycleId?: string;
  team?: RecruitmentTeam;
  status?: ApplicationStatus;
  year?: string;
  branch?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listApplications(
  actor: ActorLike,
  opts: ListApplicationsOptions = {},
): { applications: AdminApplicationSummary[]; total: number; page: number; pageSize: number } {
  if (!canReviewApplications(actor)) throw new HttpError(403, 'forbidden');

  const {
    cycleId = '2026-27',
    team,
    status,
    year,
    branch,
    search,
    page = 1,
    pageSize = 25,
  } = opts;

  const conditions: string[] = ['a.cycle_id = ?'];
  const params: unknown[] = [cycleId];

  if (team) { conditions.push('a.selected_team = ?'); params.push(team); }
  if (status) { conditions.push('a.status = ?'); params.push(status); }
  if (year) { conditions.push('a.year_of_study = ?'); params.push(year); }
  if (branch) { conditions.push('a.branch = ?'); params.push(branch); }
  if (search) {
    const like = `%${search.slice(0, 100)}%`;
    conditions.push('(a.full_name LIKE ? OR a.college_email LIKE ? OR a.usn LIKE ?)');
    params.push(like, like, like);
  }

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, page) - 1) * pageSize;

  const total = getOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM recruitment_applications a WHERE ${where}`,
    params,
  )?.count ?? 0;

  const rows = getAll<AdminApplicationSummary>(`
    SELECT
      a.id, a.cycle_id, a.status, a.full_name, a.email, a.college_email,
      a.usn, a.year_of_study, a.branch, a.selected_team, a.submitted_at,
      so.state AS sync_state
    FROM recruitment_applications a
    LEFT JOIN recruitment_sheets_outbox so ON so.application_id = a.id
    WHERE ${where}
    ORDER BY a.submitted_at DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  return { applications: rows, total, page, pageSize };
}

// ─── Admin: get single application detail ─────────────────────────────────────

export function getApplicationDetail(
  actor: ActorLike,
  applicationId: string,
): PublicApplication {
  if (!canReviewApplications(actor)) throw new HttpError(403, 'forbidden');

  const row = getOne<ApplicationRow>(
    `SELECT * FROM recruitment_applications WHERE id = ?`, [applicationId],
  );
  if (!row) throw new HttpError(404, 'application not found');

  const files = getAll<ApplicationFileRow>(
    `SELECT * FROM recruitment_application_files WHERE application_id = ?`, [applicationId],
  );
  const history = getAll<StatusHistoryRow>(
    `SELECT * FROM recruitment_status_history WHERE application_id = ? ORDER BY changed_at ASC`,
    [applicationId],
  );

  return mapApplicationRow(row, files, history);
}

function mapApplicationRow(
  row: ApplicationRow,
  files: ApplicationFileRow[] = [],
  history: StatusHistoryRow[] = [],
): PublicApplication {
  let teamResponses: Record<string, unknown> = {};
  try { teamResponses = JSON.parse(row.team_responses); } catch { /* ignore */ }

  const publicFiles: PublicApplicationFile[] = files.map((f) => ({
    id: f.id,
    field_id: f.field_id,
    original_name: f.original_name,
    mime_type: f.mime_type,
    size_bytes: f.size_bytes,
    scan_status: f.scan_status,
    uploaded_at: f.uploaded_at,
  }));

  const publicHistory: PublicStatusHistory[] = history.map((h) => ({
    id: h.id,
    old_status: h.old_status,
    new_status: h.new_status,
    actor_id: h.actor_id,
    reason: h.reason,
    changed_at: h.changed_at,
  }));

  return {
    id: row.id,
    cycle_id: row.cycle_id,
    status: row.status,
    email: row.email,
    college_email: row.college_email,
    full_name: row.full_name,
    phone: row.phone,
    usn: row.usn,
    year_of_study: row.year_of_study,
    branch: row.branch,
    selected_team: row.selected_team,
    clubs_orgs: row.clubs_orgs,
    why_join: row.why_join,
    weekly_hours: row.weekly_hours,
    team_responses: teamResponses,
    form_version: row.form_version,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    files: publicFiles,
    status_history: publicHistory,
  };
}

// ─── Admin: update application status ────────────────────────────────────────

export function updateApplicationStatus(
  actor: ActorLike,
  applicationId: string,
  newStatus: ApplicationStatus,
  reason = '',
): void {
  if (!canReviewApplications(actor)) throw new HttpError(403, 'forbidden');
  if (!ALLOWED_STATUSES.includes(newStatus)) throw new HttpError(400, 'invalid status');

  const app = getOne<{ id: string; status: ApplicationStatus; cycle_id: string }>(
    `SELECT id, status, cycle_id FROM recruitment_applications WHERE id = ?`, [applicationId],
  );
  if (!app) throw new HttpError(404, 'application not found');

  const validationResult = validateStatusTransition(app.status, newStatus);
  if (!validationResult.ok) throw new HttpError(400, validationResult.error);

  const ts = now();
  const tx = db.transaction(() => {
    runQuery(
      `UPDATE recruitment_applications SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, ts, applicationId],
    );
    runQuery(`
      INSERT INTO recruitment_status_history
        (application_id, old_status, new_status, actor_id, reason, changed_at)
      VALUES (?,?,?,?,?,?)
    `, [applicationId, app.status, newStatus, actor.id, reason.slice(0, 500), ts]);
    auditLog(app.cycle_id, actor.id as number, 'status_changed', 'application', applicationId, {
      from: app.status, to: newStatus,
    });
    // Re-queue outbox so the sheet reflects the new status
    runQuery(`
      INSERT INTO recruitment_sheets_outbox
        (application_id, idempotency_key, state, next_attempt_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(idempotency_key) DO UPDATE
      SET state = 'pending', next_attempt_at = ?, updated_at = ?
    `, [applicationId, `sync:${applicationId}`, 'pending', ts, ts, ts, ts, ts]);
  });
  tx();
}

// ─── Admin: CSV export ────────────────────────────────────────────────────────

export function exportApplicationsCsv(
  actor: ActorLike,
  cycleId = '2026-27',
): string {
  if (!canManageRecruitment(actor)) throw new HttpError(403, 'forbidden');

  auditLog(cycleId, actor.id as number, 'csv_exported', 'cycle', cycleId, {});

  const apps = getAll<ApplicationRow>(
    `SELECT * FROM recruitment_applications WHERE cycle_id = ? ORDER BY submitted_at ASC`,
    [cycleId],
  );

  const headers = [
    'id','status','full_name','email','college_email','phone','usn',
    'year_of_study','branch','selected_team','clubs_orgs','why_join',
    'weekly_hours','submitted_at','form_version',
  ];

  function escapeCell(value: unknown): string {
    const s = String(value ?? '');
    const safe = sanitizeForSheets(s);
    if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  }

  const rows = apps.map((a) => headers.map((h) => escapeCell((a as unknown as Record<string, unknown>)[h])).join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

// ─── Sync health ──────────────────────────────────────────────────────────────

export function getSyncHealth(): SyncHealthSummary {
  const row = getOne<{
    total: number; synced: number; pending: number; failed: number;
  }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN state = 'synced' THEN 1 ELSE 0 END) AS synced,
      SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM recruitment_sheets_outbox
  `);
  const lastSynced = getOne<{ synced_at: string }>(
    `SELECT synced_at FROM recruitment_sheets_outbox
     WHERE state = 'synced' ORDER BY synced_at DESC LIMIT 1`,
  );
  return {
    total_applications: row?.total ?? 0,
    synced: row?.synced ?? 0,
    pending: row?.pending ?? 0,
    failed: row?.failed ?? 0,
    last_synced_at: lastSynced?.synced_at ?? null,
  };
}

// ─── Admin: retry failed sync items ──────────────────────────────────────────

export function retryFailedSyncItems(actor: ActorLike): { reset: number } {
  if (!canManageRecruitment(actor)) throw new HttpError(403, 'forbidden');
  const ts = now();
  const result = runQuery(`
    UPDATE recruitment_sheets_outbox
    SET state = 'pending', attempts = 0, next_attempt_at = ?, updated_at = ?
    WHERE state = 'failed'
  `, [ts, ts]);
  auditLog(null, actor.id as number, 'sync_retry_triggered', 'outbox', '', {
    reset: result.changes,
  });
  return { reset: result.changes };
}

// ─── File download authorization ──────────────────────────────────────────────

export function getFileStorageKey(
  actor: ActorLike,
  fileId: string,
): string {
  if (!canReviewApplications(actor)) throw new HttpError(403, 'forbidden');
  const file = getOne<{ storage_key: string; scan_status: string }>(
    `SELECT storage_key, scan_status FROM recruitment_application_files WHERE id = ?`,
    [fileId],
  );
  if (!file) throw new HttpError(404, 'file not found');
  if (file.scan_status === 'quarantined') throw new HttpError(403, 'file is quarantined');
  return file.storage_key;
}
