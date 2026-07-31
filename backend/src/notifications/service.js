import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';

export function listNotifications(userId, { unreadOnly = false, limit = 50, offset = 0 } = {}) {
  const where = ['user_id = ?'];
  const params = [userId];
  if (unreadOnly) where.push('is_read = 0');
  const whereClause = `WHERE ${where.join(' AND ')}`;
  params.push(limit, offset);
  return db
    .prepare(
      `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params);
}

export function unreadCount(userId) {
  return db
    .prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`)
    .get(userId).count;
}

export function markRead(userId, notificationId) {
  return db
    .prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
}

export function markAllRead(userId) {
  return db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(userId);
}

export function createNotification({ userId, type, message, link }) {
  return db
    .prepare(
      `INSERT INTO notifications (user_id, type, message, link, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
    )
    .run(userId, type, message, link || null);
}

export function notifyRegistrants(eventId, notification) {
  const registrants = db
    .prepare(
      `SELECT DISTINCT user_id FROM event_registrants WHERE event_id = ? AND user_id IS NOT NULL`,
    )
    .all(Number(eventId));
  for (const r of registrants) {
    createNotification({ userId: r.user_id, ...notification });
  }
}