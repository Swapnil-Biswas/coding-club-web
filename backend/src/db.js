import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(__dirname, '..', process.env.DATABASE_FILE || './data/app.db');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema is created idempotently on every boot. For Phase 1 this is fine — we have
// exactly four tables. If we ever ship a real Phase 2, swap this for a migrations
// framework; don't let this file grow forever.
//
// Phase 2: extend users.role CHECK to allow 'core_head'. SQLite can't ALTER a
// CHECK in place, so we detect the old constraint and rebuild the table once.
const roleConstraint = db
  .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`)
  .get();
const hasCoreHead = roleConstraint && /core_head/.test(roleConstraint.sql || '');
if (roleConstraint && !hasCoreHead) {
  // Rebuild users table with the new role enum. The order of operations matters:
  // PRAGMA foreign_keys is OFF during the rebuild to avoid cascading surprises,
  // then turned back on. We restore the OFF state at the end of the transaction.
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'public' CHECK (role IN ('public','member','core','core_head','admin')),
        email_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        promoted_by INTEGER REFERENCES users(id),
        promoted_at TEXT,
        profile_photo_path TEXT
      );
      INSERT INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  });
  tx();
  db.pragma('foreign_keys = ON');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'public' CHECK (role IN ('public','member','core','core_head','admin')),
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    promoted_by INTEGER REFERENCES users(id),
    promoted_at TEXT,
    profile_photo_path TEXT,
    club_title TEXT
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    banner_image_path TEXT,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT NOT NULL,
    venue TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','member_only')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','completed')),
    unstop_link TEXT,
    organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
  CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
  CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_datetime);

  -- Phase 3: registrants imported from CSV (Unstop exports).
  -- UNIQUE(event_id, email) is what makes duplicate CSV rows a no-op
  -- instead of an error. user_id is filled in later if the email matches
  -- a user account at import time.
  CREATE TABLE IF NOT EXISTS event_registrants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    team_name TEXT NOT NULL DEFAULT '',
    qr_code_token TEXT NOT NULL UNIQUE,
    checked_in INTEGER NOT NULL DEFAULT 0,
    checked_in_at TEXT,
    checked_in_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, email)
  );
  CREATE INDEX IF NOT EXISTS idx_registrants_event ON event_registrants(event_id);
  CREATE INDEX IF NOT EXISTS idx_registrants_user ON event_registrants(user_id);
  CREATE INDEX IF NOT EXISTS idx_registrants_email ON event_registrants(email);
  CREATE INDEX IF NOT EXISTS idx_registrants_qr ON event_registrants(qr_code_token);

  -- Phase 4: Teams
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    logo_url TEXT,
    owner_core_head_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_core_head_id);

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    designation TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

  -- Phase 4: Photo Gallery
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    is_featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id);
  CREATE INDEX IF NOT EXISTS idx_photos_uploader ON photos(uploaded_by);

  -- Phase 4: Event History (only for completed events)
  CREATE TABLE IF NOT EXISTS event_history (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    gist TEXT NOT NULL DEFAULT '',
    winners TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Phase 4: Sponsors
  CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    website TEXT,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Phase 4: Join Requests
  CREATE TABLE IF NOT EXISTS join_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Phase 4: About Page Content
  CREATE TABLE IF NOT EXISTS about_page (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  -- Phase 5: Certificate Templates
  CREATE TABLE IF NOT EXISTS certificate_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    preview_image TEXT,
    template_file TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Phase 5: Certificates
  -- verification_id is a UUID, globally unique, used for the public verify page.
  -- UNIQUE(registrant_id, certificate_type) prevents duplicate certificates.
  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registrant_id INTEGER NOT NULL REFERENCES event_registrants(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    verification_id TEXT NOT NULL UNIQUE,
    certificate_type TEXT NOT NULL CHECK (certificate_type IN ('participation','winner','volunteer','speaker','organizer','special_recognition')),
    template_id INTEGER REFERENCES certificate_templates(id) ON DELETE SET NULL,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    pdf_url TEXT,
    emailed_at TEXT,
    email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
    UNIQUE(registrant_id, certificate_type)
  );
  CREATE INDEX IF NOT EXISTS idx_certificates_event ON certificates(event_id);
  CREATE INDEX IF NOT EXISTS idx_certificates_registrant ON certificates(registrant_id);

  -- Phase 5: Leaderboards
  CREATE TABLE IF NOT EXISTS leaderboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    rank INTEGER NOT NULL DEFAULT 0,
    updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, team_name)
  );
  CREATE INDEX IF NOT EXISTS idx_leaderboards_event ON leaderboards(event_id);

  -- Phase 5: Announcements
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    posted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    posted_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_announcements_event ON announcements(event_id);

  -- Phase 5: Activity Logs (President and Admin only)
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);

  -- Phase 5: Notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

  -- Phase 6: Projects showcase
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'web'
                CHECK (category IN ('web','ai','mobile','open-source','other')),
    status      TEXT NOT NULL DEFAULT 'wip'
                CHECK (status IN ('shipped','wip','concept')),
    author_name TEXT NOT NULL DEFAULT '',
    year        TEXT NOT NULL DEFAULT '',
    github_url  TEXT,
    live_url    TEXT,
    featured    INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
  CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured, sort_order);
`);
