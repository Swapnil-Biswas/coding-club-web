import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ParsedQs } from 'qs';
import { requireAuth } from '../auth/middleware.js';
import { listActivityLog, getActivityLogSummary } from './service.js';
import { integerValue, positiveId, stringValue } from '../lib/validation.js';

type ActivityLogQuery = ParsedQs & {
  userId?: string;
  entity?: string;
  entityId?: string;
  limit?: string | number;
  offset?: string | number;
};

export const activityLogRouter = Router();

activityLogRouter.get('/', requireAuth, (req: Request, res: Response): void => {
  const { userId, entity, entityId, limit, offset } = req.query as ActivityLogQuery;
  res.json(
    listActivityLog({
      actor: req.user,
      userId: userId === undefined ? undefined : positiveId(userId, 'userId'),
      entity: entity === undefined
        ? undefined
        : stringValue(entity, { field: 'entity', min: 1, max: 50 }),
      entityId: entityId === undefined ? undefined : positiveId(entityId, 'entityId'),
      limit: integerValue(limit, { field: 'limit', min: 1, max: 100, defaultValue: 100 }),
      offset: integerValue(offset, { field: 'offset', min: 0, max: 100_000, defaultValue: 0 }),
    }),
  );
});

activityLogRouter.get('/summary', requireAuth, (req: Request, res: Response): void => {
  res.json(getActivityLogSummary(req.user));
});