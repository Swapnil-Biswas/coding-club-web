import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { getAboutPage, updateAboutPage } from './service.js';

export const aboutRouter = Router();

// GET /about — public read
aboutRouter.get('/', asyncHandler(async (_req, res) => {
  const data = getAboutPage(null);
  res.json({ about: data });
}));

// PATCH /about — update (core_head, President, admin)
aboutRouter.patch(
  '/',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const data = updateAboutPage(req.user!, req.body || {});
    res.json({ about: data });
  }),
);