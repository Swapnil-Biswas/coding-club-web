import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  getPublicEventHistory,
  createOrUpdateEventHistory,
} from './history.js';

export const eventHistoryRouter = Router();

// GET /events/:id/history — public (respects event visibility)
eventHistoryRouter.get(
  '/events/:id/history',
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const history = getPublicEventHistory(eventId, req.user!);
    res.json({ history });
  }),
);

// POST /events/:id/history — create or update (core_head organizer, President, admin)
eventHistoryRouter.post(
  '/events/:id/history',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const history = createOrUpdateEventHistory(req.user!, Number(req.params.id), req.body || {});
    res.status(201).json({ history });
  }),
);

// PATCH /events/:id/history — update (core_head organizer, President, admin)
eventHistoryRouter.patch(
  '/events/:id/history',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const history = createOrUpdateEventHistory(req.user!, Number(req.params.id), req.body || {});
    res.json({ history });
  }),
);