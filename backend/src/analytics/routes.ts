import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getAnalyticsOverview, getEventAnalytics } from './service.js';

export const analyticsRouter = Router();

analyticsRouter.get('/', requireAuth, (req: Request, res: Response): void => {
  res.json(getAnalyticsOverview(req.user));
});

analyticsRouter.get('/events/:id', requireAuth, (req: Request, res: Response): void => {
  res.json(getEventAnalytics(req.user, req.params.id!));
});