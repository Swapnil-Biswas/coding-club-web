import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canViewActivityLog } from '../lib/permissions.js';
import type { ActorLike, ActivityLogRow } from '../lib/types.js';

export interface ActivityLogFilter {
  actor: ActorLike | null | undefined;
  userId?: number;
  entity?: string;
  entityId?: number;
  limit?: number;
  offset?: number;
}

export function listActivityLog({
  actor,
  userId,
  entity,
  entityId,
  limit = 100,
  offset = 0,
}: ActivityLogFilter): ActivityLogRow[] {
  if (!canViewActivityLog(actor)) throw new HttpError(403, 'forbidden');

  const where: string[] = [];
  const params: Array<string | number> = [];
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
    .prepare<ActivityLogRow>(
      `SELECT al.*, u.name as user_name, u.role as user_role
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.timestamp DESC LIMIT ? OFFSET ?`,
    )
    .all(...params);
}

export interface ActivityLogSummary {
  total_activities: number;
  active_users: number;
  top_action: string | null;
  top_entity: string | null;
}

export function getActivityLogSummary(actor: ActorLike | null | undefined): ActivityLogSummary {
  if (!canViewActivityLog(actor)) throw new HttpError(403, 'forbidden');
  return db.prepare<ActivityLogSummary>(`
    SELECT
      (SELECT COUNT(*) FROM activity_logs) as total_activities,
      (SELECT COUNT(DISTINCT user_id) FROM activity_logs) as active_users,
      (SELECT action FROM activity_logs GROUP BY action ORDER BY COUNT(*) DESC LIMIT 1) as top_action,
      (SELECT entity FROM activity_logs GROUP BY entity ORDER BY COUNT(*) DESC LIMIT 1) as top_entity
  `).get() as ActivityLogSummary;
}
