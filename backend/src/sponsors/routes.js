import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { listSponsors, createSponsor, updateSponsor, deleteSponsor } from './service.js';

export const sponsorsRouter = Router();

// GET /sponsors — public list
sponsorsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ sponsors: listSponsors() });
}));

// POST /sponsors — create (core_head, President, admin)
sponsorsRouter.post(
  '/',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const sponsor = createSponsor(req.user, req.body || {});
    res.status(201).json({ sponsor });
  }),
);

// PATCH /sponsors/:id — update
sponsorsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const sponsor = updateSponsor(req.user, req.params.id, req.body || {});
    res.json({ sponsor });
  }),
);

// DELETE /sponsors/:id — delete
sponsorsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    await deleteSponsor(req.user, req.params.id);
    res.json({ ok: true });
  }),
);