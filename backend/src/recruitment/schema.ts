// Recruitment module — idempotent SQL schema additions.
// Call initRecruitmentSchema() once at startup (from db.ts or index.ts).

import { db } from '../db.js';

export function initRecruitmentSchema(): void {
  db.exec(`
    -- ─── Recruitment Cycles ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_cycles (
      id                    TEXT PRIMARY KEY,           -- e.g. "2026-27"
      title                 TEXT NOT NULL,
      is_open               INTEGER NOT NULL DEFAULT 0 CHECK (is_open IN (0,1)),
      opened_at             TEXT,
      closed_at             TEXT,
      opened_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
      closed_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
      announcement_version  INTEGER NOT NULL DEFAULT 1,
      opens_at              TEXT,                       -- optional scheduled open
      closes_at             TEXT,                       -- optional scheduled close
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Applications ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_applications (
      id                TEXT PRIMARY KEY,               -- UUID
      cycle_id          TEXT NOT NULL REFERENCES recruitment_cycles(id) ON DELETE RESTRICT,
      idempotency_key   TEXT UNIQUE,                    -- prevent double-click duplicates
      status            TEXT NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted','under_review','shortlisted',
                                          'interview_scheduled','selected','rejected',
                                          'waitlisted','withdrawn')),
      -- Identity / Contact
      email             TEXT NOT NULL,                  -- personal contact email
      college_email     TEXT NOT NULL,                  -- institutional email (normalized for dedup)
      full_name         TEXT NOT NULL,
      phone             TEXT NOT NULL,
      usn               TEXT NOT NULL,
      year_of_study     TEXT NOT NULL CHECK (year_of_study IN ('1st year','2nd year','3rd year','4th year')),
      branch            TEXT NOT NULL,
      -- Role selection
      selected_team     TEXT NOT NULL
                        CHECK (selected_team IN ('design','marketing','events_ops',
                                                 'technical','outreach_sponsorship')),
      -- Shared section
      clubs_orgs        TEXT NOT NULL DEFAULT '',       -- clubs/orgs and roles
      why_join          TEXT NOT NULL DEFAULT '',
      weekly_hours      TEXT NOT NULL
                        CHECK (weekly_hours IN ('1–2 hrs','3–5 hrs','6–8 hrs','9+ hrs')),
      -- Team-specific responses stored as JSON text (stable field IDs)
      team_responses    TEXT NOT NULL DEFAULT '{}',
      form_version      TEXT NOT NULL DEFAULT '1.0',
      submitted_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rec_apps_cycle   ON recruitment_applications(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_rec_apps_status  ON recruitment_applications(status);
    CREATE INDEX IF NOT EXISTS idx_rec_apps_team    ON recruitment_applications(selected_team);
    CREATE INDEX IF NOT EXISTS idx_rec_apps_year    ON recruitment_applications(year_of_study);
    CREATE INDEX IF NOT EXISTS idx_rec_apps_branch  ON recruitment_applications(branch);
    CREATE INDEX IF NOT EXISTS idx_rec_apps_email   ON recruitment_applications(college_email);
    CREATE INDEX IF NOT EXISTS idx_rec_apps_submitted ON recruitment_applications(submitted_at);
    -- Prevent duplicate submissions per cycle per college email
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rec_apps_cycle_email
      ON recruitment_applications(cycle_id, college_email)
      WHERE status != 'withdrawn';

    -- ─── Application Files ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_application_files (
      id              TEXT PRIMARY KEY,                 -- UUID
      application_id  TEXT NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
      field_id        TEXT NOT NULL,                   -- e.g. "design_upload"
      original_name   TEXT NOT NULL,                   -- sanitized original filename
      mime_type       TEXT NOT NULL,
      size_bytes      INTEGER NOT NULL,
      storage_key     TEXT NOT NULL UNIQUE,            -- opaque private path
      checksum_sha256 TEXT NOT NULL,
      scan_status     TEXT NOT NULL DEFAULT 'pending'
                      CHECK (scan_status IN ('pending','clean','quarantined','skipped')),
      uploaded_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rec_files_app ON recruitment_application_files(application_id);

    -- ─── Application Status History ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_status_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
      old_status    TEXT NOT NULL,
      new_status    TEXT NOT NULL,
      actor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason        TEXT NOT NULL DEFAULT '',
      changed_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rec_status_hist_app ON recruitment_status_history(application_id);

    -- ─── Review Assignments ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_review_assignments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
      reviewer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(application_id, reviewer_id)
    );

    -- ─── Application Reviews ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_reviews (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
      reviewer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score          INTEGER,                          -- optional rubric score
      feedback       TEXT NOT NULL DEFAULT '',        -- structured / public feedback
      private_notes  TEXT NOT NULL DEFAULT '',        -- reviewer-only notes
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(application_id, reviewer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rec_reviews_app ON recruitment_reviews(application_id);
    CREATE INDEX IF NOT EXISTS idx_rec_reviews_reviewer ON recruitment_reviews(reviewer_id);

    -- ─── Recruitment Audit Log ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id    TEXT REFERENCES recruitment_cycles(id) ON DELETE SET NULL,
      actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT NOT NULL,                      -- e.g. "cycle_opened", "status_changed"
      entity      TEXT NOT NULL DEFAULT '',           -- e.g. "application", "cycle"
      entity_id   TEXT NOT NULL DEFAULT '',
      details     TEXT NOT NULL DEFAULT '',           -- JSON string, no secrets
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rec_audit_cycle ON recruitment_audit_log(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_rec_audit_actor ON recruitment_audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_rec_audit_time  ON recruitment_audit_log(created_at);

    -- ─── Google Sheets Sync Outbox ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recruitment_sheets_outbox (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id  TEXT NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL UNIQUE,           -- stable per application
      state           TEXT NOT NULL DEFAULT 'pending'
                      CHECK (state IN ('pending','synced','failed')),
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_error      TEXT,
      synced_at       TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rec_outbox_state    ON recruitment_sheets_outbox(state, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_rec_outbox_app      ON recruitment_sheets_outbox(application_id);
  `);

  // Seed the 2026-27 cycle as closed if it doesn't exist yet.
  const existing = db.prepare<{ id: string }>(
    `SELECT id FROM recruitment_cycles WHERE id = ?`
  ).get('2026-27');
  if (!existing) {
    db.prepare(`
      INSERT INTO recruitment_cycles (id, title, is_open)
      VALUES ('2026-27', 'Coding Club Recruitment 2026–27', 0)
    `).run();
  }
}
