import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageEvent, canPostAnnouncement, canViewAnnouncements, logActivity, notifyRegistrants } from '../lib/permissions.js';
import { positiveId, stringValue } from '../lib/validation.js';
import type { ActorLike, AnnouncementRow, EventRow, JsonRecord } from '../lib/types.js';

type Id = string | number;

interface AnnouncementPayload {
  message?: unknown;
}

function publicAnnouncement(row: AnnouncementRow | null | undefined): AnnouncementRow | null {
  if (!row) return null;
  return {
    id: row.id,
    event_id: row.event_id,
    message: row.message,
    posted_by: row.posted_by,
    posted_at: row.posted_at,
    posted_by_name: row.posted_by_name,
    posted_by_role: row.posted_by_role,
  };
}

export function listAnnouncements(
  eventId: Id,
  viewer: ActorLike | null | undefined,
): AnnouncementRow[] {
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(positiveId(eventId, 'event id'));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canViewAnnouncements(viewer, event)) throw new HttpError(403, 'forbidden');

  const rows = db
    .prepare<AnnouncementRow>(
      `SELECT a.*, u.name as posted_by_name, u.role as posted_by_role
       FROM announcements a
       JOIN users u ON u.id = a.posted_by
       WHERE a.event_id = ?
       ORDER BY a.posted_at DESC`,
    )
    .all(event.id);
  return rows.map((row) => publicAnnouncement(row)!);
}

export function createAnnouncement(
  actor: ActorLike,
  eventId: Id,
  body: AnnouncementPayload,
): AnnouncementRow | null {
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(positiveId(eventId, 'event id'));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canPostAnnouncement(actor, event)) throw new HttpError(403, 'forbidden');

  const message = stringValue(body?.message, {
    field: 'message',
    min: 1,
    max: 1_000,
  });

  const result = db
    .prepare(
      `INSERT INTO announcements (event_id, message, posted_by) VALUES (?, ?, ?)`,
    )
    .run(event.id, message, actor.id);

  const announcement = db
    .prepare<AnnouncementRow>(`SELECT * FROM announcements WHERE id = ?`)
    .get(result.lastInsertRowid)!;

  // Notify all registrants
  notifyRegistrants(event.id, {
    type: 'announcement',
    message: `New announcement for "${event.title}": ${message}`,
    link: `/events/${event.id}`,
  });

  logActivity({
    userId: actor.id,
    action: 'Created Announcement',
    entity: 'announcement',
    entityId: announcement.id,
    details: { event_id: event.id, message: message.slice(0, 100) },
  });

  return publicAnnouncement({ ...announcement, posted_by_name: actor.name, posted_by_role: actor.role });
}

export function deleteAnnouncement(actor: ActorLike, announcementId: Id): { ok: true } {
  const announcement = db
    .prepare<AnnouncementRow>(`SELECT * FROM announcements WHERE id = ?`)
    .get(positiveId(announcementId, 'announcement id'));
  if (!announcement) throw new HttpError(404, 'announcement not found');

  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(announcement.event_id);
  if (!event) throw new HttpError(404, 'event not found');

  if (actor.id !== announcement.posted_by && !canManageEvent(actor, event)) {
    throw new HttpError(403, 'forbidden');
  }

  db.prepare(`DELETE FROM announcements WHERE id = ?`).run(announcement.id);

  logActivity({
    userId: actor.id,
    action: 'Deleted Announcement',
    entity: 'announcement',
    entityId: announcement.id,
    details: { event_id: event.id },
  });

  return { ok: true };
}