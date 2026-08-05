import type Database from 'better-sqlite3';
import { db } from '../db.js';
import type { NotificationRow } from '../lib/types.js';

export interface NotificationListOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateNotificationInput {
  userId: number;
  type: string;
  message: string;
  link?: string | null;
}

interface NotificationCountRow {
  count: number;
}

interface RegistrantUserRow {
  user_id: number;
}

export function listNotifications(
  userId: number,
  { unreadOnly = false, limit = 50, offset = 0 }: NotificationListOptions = {},
): NotificationRow[] {
  const where: string[] = ['user_id = ?'];
  const params: number[] = [userId];
  if (unreadOnly) where.push('is_read = 0');
  const whereClause = `WHERE ${where.join(' AND ')}`;
  params.push(limit, offset);
  return db
    .prepare<NotificationRow>(
      `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params);
}

export function unreadCount(userId: number): number {
  return (
    db
      .prepare<NotificationCountRow>(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      )
      .get(userId)?.count ?? 0
  );
}

export function markRead(userId: number, notificationId: string): Database.RunResult {
  return db
    .prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
}

export function markAllRead(userId: number): Database.RunResult {
  return db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(userId);
}

export function createNotification({
  userId,
  type,
  message,
  link,
}: CreateNotificationInput): Database.RunResult {
  return db
    .prepare(
      `INSERT INTO notifications (user_id, type, message, link, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
    )
    .run(userId, type, message, link || null);
}

export function notifyRegistrants(
  eventId: number | string,
  notification: Omit<CreateNotificationInput, 'userId'>,
): void {
  const registrants = db
    .prepare<RegistrantUserRow>(
      `SELECT DISTINCT user_id FROM event_registrants WHERE event_id = ? AND user_id IS NOT NULL`,
    )
    .all(Number(eventId));
  for (const r of registrants) {
    createNotification({ userId: r.user_id, ...notification });
  }
}