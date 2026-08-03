import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';

// Roles that may see contact-tier fields (linkedin, github, whatsapp).
// member, faculty, and public get ONLY basic-tier fields — identical responses.
const CONTACT_TIER_ROLES = ['core', 'core_head', 'admin'];

// ── Serializers ────────────────────────────────────────────────────────────

// Basic tier — safe for everyone (public, logged-out, member, faculty).
function basicMentor(row) {
  if (!row) return null;
  return {
    id:           row.id,
    name:         row.name,
    photo_url:    row.photo_url  || null,
    bio:          row.bio        || '',
    current_role: row.current_role || null,
    organization: row.organization || '',
    is_active:    Boolean(row.is_active),
    sort_order:   row.sort_order,
    created_at:   row.created_at,
    updated_at:   row.updated_at,
    // Contact-tier fields intentionally ABSENT — not null, not empty string,
    // simply not present in the object so they never appear in JSON responses.
  };
}

// Full tier — basic + contact fields. Only for core / core_head / admin.
function fullMentor(row) {
  if (!row) return null;
  return {
    ...basicMentor(row),
    linkedin_url:    row.linkedin_url    || null,
    github_url:      row.github_url      || null,
    whatsapp_number: row.whatsapp_number || null,
  };
}

// Pick the right serializer based on the viewer's role.
function serialize(row, viewer) {
  if (!row) return null;
  const role = viewer?.role ?? null;
  return CONTACT_TIER_ROLES.includes(role) ? fullMentor(row) : basicMentor(row);
}

// ── Queries ────────────────────────────────────────────────────────────────

export function listMentors(viewer) {
  // Public listing: only active mentors, ordered by sort_order then name.
  const rows = db
    .prepare(
      `SELECT * FROM mentors
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`,
    )
    .all();
  return rows.map((r) => serialize(r, viewer));
}

export function getMentorById(id, viewer) {
  const row = db.prepare(`SELECT * FROM mentors WHERE id = ?`).get(Number(id));
  if (!row) return null;
  // Inactive mentors are hidden from non-admin viewers.
  if (!row.is_active && !CONTACT_TIER_ROLES.includes(viewer?.role)) {
    return null;
  }
  return serialize(row, viewer);
}

// Admin-only: list all mentors including inactive (for management UI).
export function listAllMentors() {
  return db
    .prepare(`SELECT * FROM mentors ORDER BY sort_order ASC, name ASC`)
    .all()
    .map(fullMentor);
}

// ── Mutations (admin only — enforced at route level) ───────────────────────

export function createMentor(actor, body) {
  const {
    name, photo_url, bio, current_role, organization,
    linkedin_url, github_url, whatsapp_number,
    is_active = 1, sort_order = 0,
  } = body || {};

  if (!name?.trim()) throw new HttpError(400, 'name is required');

  const result = db.prepare(`
    INSERT INTO mentors
      (name, photo_url, bio, current_role, organization,
       linkedin_url, github_url, whatsapp_number,
       is_active, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    photo_url?.trim() || null,
    bio?.trim() || '',
    current_role?.trim() || null,
    organization?.trim() || '',
    linkedin_url?.trim() || null,
    github_url?.trim() || null,
    whatsapp_number?.trim() || null,
    is_active ? 1 : 0,
    Number(sort_order) || 0,
    actor.id,
  );

  return fullMentor(
    db.prepare(`SELECT * FROM mentors WHERE id = ?`).get(result.lastInsertRowid),
  );
}

export function updateMentor(actor, id, body) {
  const existing = db.prepare(`SELECT * FROM mentors WHERE id = ?`).get(Number(id));
  if (!existing) throw new HttpError(404, 'mentor not found');

  const {
    name         = existing.name,
    photo_url    = existing.photo_url,
    bio          = existing.bio,
    current_role = existing.current_role,
    organization = existing.organization,
    linkedin_url = existing.linkedin_url,
    github_url   = existing.github_url,
    whatsapp_number = existing.whatsapp_number,
    is_active    = existing.is_active,
    sort_order   = existing.sort_order,
  } = body || {};

  if (!name?.trim()) throw new HttpError(400, 'name is required');

  db.prepare(`
    UPDATE mentors SET
      name             = ?,
      photo_url        = ?,
      bio              = ?,
      current_role     = ?,
      organization     = ?,
      linkedin_url     = ?,
      github_url       = ?,
      whatsapp_number  = ?,
      is_active        = ?,
      sort_order       = ?,
      updated_at       = datetime('now')
    WHERE id = ?
  `).run(
    name.trim(),
    photo_url?.trim() || null,
    bio?.trim() || '',
    current_role?.trim() || null,
    organization?.trim() || '',
    linkedin_url?.trim() || null,
    github_url?.trim() || null,
    whatsapp_number?.trim() || null,
    is_active ? 1 : 0,
    Number(sort_order) || 0,
    Number(id),
  );

  return fullMentor(db.prepare(`SELECT * FROM mentors WHERE id = ?`).get(Number(id)));
}

// Soft-delete: set is_active = 0. Data is never destroyed.
export function deactivateMentor(id) {
  const existing = db.prepare(`SELECT id FROM mentors WHERE id = ?`).get(Number(id));
  if (!existing) throw new HttpError(404, 'mentor not found');
  db.prepare(`UPDATE mentors SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(Number(id));
  return { ok: true };
}
