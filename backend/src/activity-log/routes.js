import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { listActivityLog, getActivityLogSummary } from './service.js';

export const activityLogRouter = Router();

activityLogRouter.get('/', requireAuth, (req, res) => {
  const { userId, entity, entityId, limit = 100, offset = 0 } = req.query;
  res.json(
    listActivityLog({
      actor: req.user,
      userId: userId ? Number(userId) : undefined,
      entity,
      entityId: entityId ? Number(entityId) : undefined,
      limit: Number(limit),
      offset: Number(offset),
    }),
  );
});

activityLogRouter.get('/summary', requireAuth, (req, res) => {
  res.json(getActivityLogSummary(req.user));
});