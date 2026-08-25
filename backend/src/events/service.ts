import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { enqueueManagedImageDeletion, publicImageReference } from '../lib/imageUpload.js';
import type { ActorLike, EventRow, EventStatus, EventVisibility, PublicEvent, Role } from '../lib/types.js';
import { httpUrl } from '../lib/validation.js';

// --- Role helpers --------------------------------------------------------

// The Phase 2 hierarchy:
//   public < member < core < core_head < admin
// Phase 1 didn't have core_head, so the auth middleware was unaware of it. The
// events layer is where the new tier actually matters for permissions, so we
// compare against a numeric rank rather than a string list. Future phases that
// add capabilities (certificates, etc.) can call into the same rank.
const ROLE_RANK: Partial<Record<Role, number>> = { public: 0, member: 1, core: 2, core_head: 3, admin: 4 };

export function roleAtLeast(role: Role | undefined, minRole: Role): boolean {
  return (role ? (ROLE_RANK[role] ?? 0) : 0) >= (ROLE_RANK[minRole] ?? 0);
}

// --- Capability checks (server-side) -------------------------------------

// Spec says core+ can create/edit/delete events. core_head and admin are a
// strict superset, so we treat them as core+ here. The spec also gives
// core_head/admin extra publish/force-complete powers; those are separate.
export const EVENT_MANAGERS: readonly Role[] = ['core', 'core_head', 'admin'];
export const PUBLISHERS: readonly Role[] = ['core_head', 'admin'];

export function canCreateEvents(role: Role): boolean {
  return EVENT_MANAGERS.includes(role);
}
export function canEditAnyEvent(role: Role): boolean {
  // Spec: "Core can edit any event" — not just events they organized. So
  // the check is role-based, not ownership-based. Same for core_head/admin.
  return EVENT_MANAGERS.includes(role);
}
export function canDeleteEvents(role: Role): boolean {
  return EVENT_MANAGERS.includes(role);
}
export function canPublish(role: Role): boolean {
  return PUBLISHERS.includes(role);
}
export function canForceComplete(role: Role): boolean {
  return PUBLISHERS.includes(role);
}

// --- Visibility rules ----------------------------------------------------

// What can this viewer see, given their role?
//   public/logged-out:  (published OR completed) + public
//   member:             (published OR completed) + (public OR member_only)
//   core/core_head/admin: everything, including drafts
//   faculty: observer — sees all events including drafts (read-only)
function visibilityClause(viewer: ActorLike | null | undefined): { sql: string; params: unknown[] } {
  if (viewer && (roleAtLeast(viewer.role, 'core') || viewer.role === 'faculty')) {
    // core+  and faculty see all events regardless of status or visibility.
    return { sql: '1=1', params: [] };
  }
  if (viewer && viewer.role === 'member') {
    // member sees published and completed events of either visibility.
    return { sql: `status IN ('published', 'completed')`, params: [] };
  }
  // public / logged-out: published or completed public only.
  return { sql: `status IN ('published', 'completed') AND visibility = 'public'`, params: [] };
}

// --- Mapping -------------------------------------------------------------

export function publicEvent(row: EventRow | null | undefined): PublicEvent | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    banner_image_url: publicImageReference(row.banner_image_path, 'events'),
    start_datetime: row.start_datetime,
    end_datetime: row.end_datetime,
    venue: row.venue,
    category: row.category,
    visibility: row.visibility,
    status: row.status,
    unstop_link: row.unstop_link,
    organizer_id: row.organizer_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- Queries -------------------------------------------------------------

export function listEvents(viewer: ActorLike | null | undefined): PublicEvent[] {
  const { sql, params } = visibilityClause(viewer);
  const rows = db
    .prepare<EventRow>(
      `SELECT * FROM events WHERE ${sql} ORDER BY start_datetime DESC, id DESC`,
    )
    .all(...params);
  return rows.map((row) => publicEvent(row)!);
}

export function getEvent(viewer: ActorLike | null | undefined, id: number | string): PublicEvent {
  const row = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(id));
  if (!row) throw new HttpError(404, 'event not found');

  // Re-apply the visibility filter. If the viewer can't see this event,
  // pretend it doesn't exist — never leak "this exists but you can't see it."
  const { sql, params } = visibilityClause(viewer);
  const visible = db
    .prepare(`SELECT 1 AS x FROM events WHERE id = ? AND ${sql}`)
    .get(Number(id), ...params);
  if (!visible) throw new HttpError(404, 'event not found');

  return publicEvent(row)!;
}

// --- Mutations ------------------------------------------------------------

// Fields that can be supplied on create or update. Anything else is dropped
// to avoid mass-assignment style bugs (e.g. letting a client set organizer_id
// or status directly).
type EditableEventField = 'title' | 'description' | 'start_datetime' | 'end_datetime' | 'venue' | 'category' | 'visibility' | 'unstop_link';

type EditableEventData = Partial<Pick<EventRow, EditableEventField>>;

export type EventPayload = Partial<Record<EditableEventField, string | null>> & {
  status?: EventStatus;
};

const EDITABLE_FIELDS: readonly EditableEventField[] = [
  'title',
  'description',
  'start_datetime',
  'end_datetime',
  'venue',
  'category',
  'visibility',
  'unstop_link',
];

function validatePayload(body: EventPayload, { isCreate }: { isCreate: boolean }): EditableEventData {
  const out: EditableEventData = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key] as never;
  }
  if (isCreate || body.title !== undefined) {
    if (!out.title || !String(out.title).trim()) {
      throw new HttpError(400, 'title is required');
    }
  }
  if (isCreate || body.start_datetime !== undefined) {
    if (!out.start_datetime) throw new HttpError(400, 'start_datetime is required');
    if (Number.isNaN(Date.parse(out.start_datetime))) {
      throw new HttpError(400, 'start_datetime is not a valid date');
    }
  }
  if (isCreate || body.end_datetime !== undefined) {
    if (!out.end_datetime) throw new HttpError(400, 'end_datetime is required');
    if (Number.isNaN(Date.parse(out.end_datetime))) {
      throw new HttpError(400, 'end_datetime is not a valid date');
    }
  }
  if (out.start_datetime && out.end_datetime) {
    if (Date.parse(out.end_datetime) < Date.parse(out.start_datetime)) {
      throw new HttpError(400, 'end_datetime must be after start_datetime');
    }
  }
  if (out.visibility !== undefined && !['public', 'member_only'].includes(out.visibility)) {
    throw new HttpError(400, 'visibility must be "public" or "member_only"');
  }
  if (out.unstop_link !== undefined) {
    // Empty string means "clear the link" — store as null.
    if (out.unstop_link === '' || out.unstop_link === null) {
      out.unstop_link = null;
    } else {
      out.unstop_link = httpUrl(out.unstop_link, {
        field: 'registration_link',
        // No host restriction — events can use any registration platform
        // (Unstop, Devfolio, Mastery Hub, Google Forms, etc.)
      });
    }
  }
  return out;
}

function validateStatus(newStatus: EventStatus, currentEvent: EventRow, actor: ActorLike): void {
  if (!['draft', 'published', 'completed'].includes(newStatus)) {
    throw new HttpError(400, 'invalid status');
  }
  // Anyone event-management role can move to draft or completed (if force
  // permissions are met). But publish is gated separately.
  if (newStatus === 'published') {
    if (!canPublish(actor.role)) {
      throw new HttpError(403, 'only core_head or admin can publish events');
    }
    // unstop_link is optional — events can be published without it.
  }

  if (newStatus === 'completed') {
    if (!canForceComplete(actor.role)) {
      throw new HttpError(403, 'only core_head or admin can force-complete events');
    }
  }
}

export function createEvent(actor: ActorLike, body: EventPayload): PublicEvent {
  if (!canCreateEvents(actor.role)) {
    throw new HttpError(403, 'forbidden');
  }
  const data = validatePayload(body, { isCreate: true });

  const result = db
    .prepare(
      `INSERT INTO events
        (title, description, start_datetime, end_datetime, venue, category,
         visibility, status, unstop_link, organizer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .run(
      String(data.title).trim(),
      data.description ?? '',
      data.start_datetime,
      data.end_datetime,
      data.venue ?? '',
      data.category ?? '',
      data.visibility ?? 'public',
      data.unstop_link ?? null,
      actor.id,
    );

  return publicEvent(db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(result.lastInsertRowid))!;
}

export function updateEvent(actor: ActorLike, id: number | string, body: EventPayload): PublicEvent {
  if (!canEditAnyEvent(actor.role)) {
    throw new HttpError(403, 'forbidden');
  }
  const current = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(id));
  if (!current) throw new HttpError(404, 'event not found');

  const data = validatePayload(body, { isCreate: false });

  // Status transitions get special handling.
  if (body.status !== undefined) {
    validateStatus(body.status, current, actor);
  }

  // Allow clearing the unstop_link by passing an empty string — treat it as null.

  // Build the SET clause from editable fields + optional status.
  const sets = [];
  const params = [];
  for (const key of EDITABLE_FIELDS) {
    if (key in data) {
      sets.push(`${key} = ?`);
      params.push(data[key] ?? null);
    }
  }
  if (body.status !== undefined) {
    sets.push('status = ?');
    params.push(body.status);
  }
  if (sets.length === 0) {
    // Nothing to update; return current.
    return publicEvent(current)!;
  }
  sets.push(`updated_at = datetime('now')`);
  params.push(Number(id));

  db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicEvent(db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(id)))!;
}

export function deleteEvent(actor: ActorLike, id: number | string): { ok: true } {
  if (!canDeleteEvents(actor.role)) {
    throw new HttpError(403, 'forbidden');
  }
  const current = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(id));
  if (!current) throw new HttpError(404, 'event not found');
  db.prepare(`DELETE FROM events WHERE id = ?`).run(Number(id));
  return { ok: true };
}

export function setBannerImagePath(eventId: number, filename: string): void {
  db.prepare(`UPDATE events SET banner_image_path = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(filename, eventId);
}

export function getEventById(id: number | string): EventRow | undefined {
  return db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(id));
}

