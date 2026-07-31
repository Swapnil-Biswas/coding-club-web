import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canViewActivityLog } from '../lib/permissions.js';

export function listActivityLog({ actor, userId, entity, entityId, limit = 100, offset = 0 }) {
  if (!canViewActivityLog(actor)) throw new HttpError(403, 'forbidden');

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
      `SELECT al.*, u.name as user_name, u.role as user_role
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.timestamp DESC LIMIT ? OFFSET ?`,
    )
    .all(...params);
}

export function getActivityLogSummary(actor) {
  if (!canViewActivityLog(actor)) throw new HttpError(403, 'forbidden');
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM activity_logs) as total_activities,
      (SELECT COUNT(DISTINCT user_id) FROM activity_logs) as active_users,
      (SELECT action FROM activity_logs GROUP BY action ORDER BY COUNT(*) DESC LIMIT 1) as top_action,
      (SELECT entity FROM activity_logs GROUP BY entity ORDER BY COUNT(*) DESC LIMIT 1) as top_entity
  `).get();
}