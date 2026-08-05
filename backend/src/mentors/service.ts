import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { publicImageReference, validateImageReference } from '../lib/imageUpload.js';
import type { ActorLike, BasicMentor, FullMentor, MentorRow, Role } from '../lib/types.js';
import { booleanValue, httpUrl, integerValue, positiveId, stringValue } from '../lib/validation.js';

// Roles that may see contact-tier fields (linkedin, github, whatsapp).
// member, faculty, and public get ONLY basic-tier fields — identical responses.
const CONTACT_TIER_ROLES: readonly Role[] = ['core', 'core_head', 'admin'];

export interface MentorPayload {
  name?: string;
  photo_url?: string | null;
  bio?: string;
  current_role?: string | null;
  organization?: string;
  linkedin_url?: string | null;
  github_url?: string | null;
  whatsapp_number?: string | null;
  is_active?: boolean | number;
  sort_order?: number | string;
}

function canSeeContactTier(role: Role | null | undefined): boolean {
  return !!role && CONTACT_TIER_ROLES.includes(role);
}

// ── Serializers ────────────────────────────────────────────────────────────

// Basic tier — safe for everyone (public, logged-out, member, faculty).
function basicMentor(row: MentorRow | null | undefined): BasicMentor | null {
  if (!row) return null;
  return {
    id:           row.id,
    name:         row.name,
    photo_url:    publicImageReference(row.photo_url),
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
function fullMentor(row: MentorRow | null | undefined): FullMentor | null {
  if (!row) return null;
  const basic = basicMentor(row)!;
  return {
    ...basic,
    linkedin_url:    row.linkedin_url    || null,
    github_url:      row.github_url      || null,
    whatsapp_number: row.whatsapp_number || null,
  };
}

// Pick the right serializer based on the viewer's role.
function serialize(row: MentorRow | null | undefined, viewer: ActorLike | null | undefined): BasicMentor | FullMentor | null {
  if (!row) return null;
  const role = viewer?.role ?? null;
  return canSeeContactTier(role) ? fullMentor(row) : basicMentor(row);
}

// ── Queries ────────────────────────────────────────────────────────────────

export function listMentors(viewer: ActorLike | null | undefined): Array<BasicMentor | FullMentor> {
  // Public listing: only active mentors, ordered by sort_order then name.
  const rows = db
    .prepare<MentorRow>(
      `SELECT * FROM mentors
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`,
    )
    .all();
  return rows.map((r) => serialize(r, viewer)!);
}

export function getMentorById(id: number | string, viewer: ActorLike | null | undefined): BasicMentor | FullMentor | null {
  const row = db.prepare<MentorRow>(`SELECT * FROM mentors WHERE id = ?`).get(positiveId(id, 'mentor id'));
  if (!row) return null;
  // Inactive mentors are hidden from non-admin viewers.
  if (!row.is_active && !canSeeContactTier(viewer?.role)) {
    return null;
  }
  return serialize(row, viewer);
}

// Admin-only: list all mentors including inactive (for management UI).
export function listAllMentors(): FullMentor[] {
  return db
    .prepare<MentorRow>(`SELECT * FROM mentors ORDER BY sort_order ASC, name ASC`)
    .all()
    .map((row) => fullMentor(row)!);
}

// ── Mutations (admin only — enforced at route level) ───────────────────────

export function createMentor(actor: ActorLike, body: MentorPayload): FullMentor | null {
  const {
    name, photo_url, bio, current_role, organization,
    linkedin_url, github_url, whatsapp_number,
    is_active = 1, sort_order = 0,
  } = body || {};

  const mentorName = stringValue(name, { field: 'name', min: 1, max: 150 });
  const mentorBio = stringValue(bio, { field: 'bio', max: 5_000, required: false });
  const mentorRole = stringValue(current_role, { field: 'current_role', max: 150, required: false }) || null;
  const mentorOrganization = stringValue(organization, { field: 'organization', max: 200, required: false });
  const linkedinUrl = httpUrl(linkedin_url, { field: 'linkedin_url', allowedHosts: ['linkedin.com'] });
  const githubUrl = httpUrl(github_url, { field: 'github_url', allowedHosts: ['github.com'] });
  const whatsappNumber = stringValue(whatsapp_number, { field: 'whatsapp_number', max: 30, required: false }) || null;
  if (whatsappNumber && !/^\+?[0-9 ()-]{7,30}$/.test(whatsappNumber)) {
    throw new HttpError(400, 'whatsapp_number is invalid');
  }

  const result = db.prepare(`
    INSERT INTO mentors
      (name, photo_url, bio, current_role, organization,
       linkedin_url, github_url, whatsapp_number,
       is_active, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mentorName,
    photo_url ? validateImageReference(photo_url, 'photo_url') : null,
    mentorBio,
    mentorRole,
    mentorOrganization,
    linkedinUrl,
    githubUrl,
    whatsappNumber,
    Number(booleanValue(is_active, 'is_active')),
    integerValue(sort_order, { field: 'sort_order', min: 0, max: 100_000 }),
    actor.id,
  );

  return fullMentor(
    db.prepare<MentorRow>(`SELECT * FROM mentors WHERE id = ?`).get(result.lastInsertRowid),
  );
}

export function updateMentor(_actor: ActorLike, id: number | string, body: MentorPayload): FullMentor | null {
  const existing = db.prepare<MentorRow>(`SELECT * FROM mentors WHERE id = ?`).get(positiveId(id, 'mentor id'));
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

  const mentorId = positiveId(id, 'mentor id');
  const mentorName = stringValue(name, { field: 'name', min: 1, max: 150 });
  const mentorBio = stringValue(bio, { field: 'bio', max: 5_000, required: false });
  const mentorRole = stringValue(current_role, { field: 'current_role', max: 150, required: false }) || null;
  const mentorOrganization = stringValue(organization, { field: 'organization', max: 200, required: false });
  const linkedinUrl = httpUrl(linkedin_url, { field: 'linkedin_url', allowedHosts: ['linkedin.com'] });
  const githubUrl = httpUrl(github_url, { field: 'github_url', allowedHosts: ['github.com'] });
  const whatsappNumber = stringValue(whatsapp_number, { field: 'whatsapp_number', max: 30, required: false }) || null;
  if (whatsappNumber && !/^\+?[0-9 ()-]{7,30}$/.test(whatsappNumber)) {
    throw new HttpError(400, 'whatsapp_number is invalid');
  }

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
    mentorName,
    photo_url ? validateImageReference(photo_url, 'photo_url') : null,
    mentorBio,
    mentorRole,
    mentorOrganization,
    linkedinUrl,
    githubUrl,
    whatsappNumber,
    Number(booleanValue(is_active, 'is_active')),
    integerValue(sort_order, { field: 'sort_order', min: 0, max: 100_000 }),
    mentorId,
  );

  return fullMentor(db.prepare<MentorRow>(`SELECT * FROM mentors WHERE id = ?`).get(mentorId));
}

// Soft-delete: set is_active = 0. Data is never destroyed.
export function deactivateMentor(id: number | string): { ok: true } {
  const existing = db.prepare<Pick<MentorRow, 'id'>>(`SELECT id FROM mentors WHERE id = ?`).get(positiveId(id, 'mentor id'));
  if (!existing) throw new HttpError(404, 'mentor not found');
  db.prepare(`UPDATE mentors SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(positiveId(id, 'mentor id'));
  return { ok: true };
}
