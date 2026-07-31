import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canPostAnnouncement, canViewAnnouncements, logActivity, notifyRegistrants } from '../lib/permissions.js';

function publicAnnouncement(row) {
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

export function listAnnouncements(eventId, viewer) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canViewAnnouncements(viewer, event)) throw new HttpError(403, 'forbidden');

  const rows = db
    .prepare(
      `SELECT a.*, u.name as posted_by_name, u.role as posted_by_role
       FROM announcements a
       JOIN users u ON u.id = a.posted_by
       WHERE a.event_id = ?
       ORDER BY a.posted_at DESC`,
    )
    .all(event.id);
  return rows.map(publicAnnouncement);
}

export function createAnnouncement(actor, eventId, body) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canPostAnnouncement(actor, event)) throw new HttpError(403, 'forbidden');

  const message = String(body?.message || '').trim();
  if (!message) throw new HttpError(400, 'message required');

  const result = db
    .prepare(
      `INSERT INTO announcements (event_id, message, posted_by) VALUES (?, ?, ?)`,
    )
    .run(event.id, message, actor.id);

  const announcement = db.prepare(`SELECT * FROM announcements WHERE id = ?`).get(result.lastInsertRowid);

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

export function deleteAnnouncement(actor, announcementId) {
  const announcement = db.prepare(`SELECT * FROM announcements WHERE id = ?`).get(Number(announcementId));
  if (!announcement) throw new HttpError(404, 'announcement not found');

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(announcement.event_id);
  if (!event) throw new HttpError(404, 'event not found');

  if (actor.role !== 'admin' && actor.role !== 'core_head' && actor.id !== announcement.posted_by) {
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