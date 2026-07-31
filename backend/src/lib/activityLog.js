import { db } from '../db.js';

export function logActivity({ userId, action, entity, entityId, details }) {
  if (!userId) return;
  db.prepare(
    `INSERT INTO activity_logs (user_id, action, entity, entity_id, details, timestamp)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).run(userId, action, entity, entityId, JSON.stringify(details || {}));
}

export function listActivityLog({ userId, entity, entityId, limit = 100, offset = 0 }) {
  const where = [];
  const params = [];
  if (userId) {
    where.push('user_id = ?');
    params.push(userId);
  }
  if (entity) {
    where.push('entity = ?');
    params.push(entity);
  }
  if (entityId) {
    where.push('entity_id = ?');
    params.push(entityId);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit, offset);
  return db
    .prepare(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    )
    .all(...params);
}

export function getActivityLogSummary() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM activity_logs) as total_activities,
      (SELECT COUNT(DISTINCT user_id) FROM activity_logs) as active_users,
      (SELECT action FROM activity_logs GROUP BY action ORDER BY COUNT(*) DESC LIMIT 1) as top_action,
      (SELECT entity FROM activity_logs GROUP BY entity ORDER BY COUNT(*) DESC LIMIT 1) as top_entity
  `).get();
}