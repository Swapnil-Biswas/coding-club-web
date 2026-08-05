import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { getPublicEventHistory, createOrUpdateEventHistory } from './service.js';

export const eventHistoryRouter = Router();

// GET /event-history/:eventId — public history for an event
eventHistoryRouter.get(
  '/:eventId',
  asyncHandler(async (req, res) => {
    const history = getPublicEventHistory(Number(req.params.eventId), req.user!);
    res.json({ history });
  }),
);

// POST /event-history/:eventId — create/update history (core_head owner, President, admin)
eventHistoryRouter.post(
  '/:eventId',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const history = createOrUpdateEventHistory(req.user!, Number(req.params.eventId), req.body || {});
    res.status(201).json({ history });
  }),
);

// PATCH /event-history/:eventId — alias for POST (idempotent)
eventHistoryRouter.patch(
  '/:eventId',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const history = createOrUpdateEventHistory(req.user!, Number(req.params.eventId), req.body || {});
    res.json({ history });
  }),
);