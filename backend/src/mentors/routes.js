import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  listMentors,
  getMentorById,
  listAllMentors,
  createMentor,
  updateMentor,
  deactivateMentor,
} from './service.js';

export const mentorsRouter = Router();

// ── GET /mentors ──────────────────────────────────────────────────────────
// Public — no auth required.  Tiering is applied server-side in the service:
//   - public/member/faculty → basic fields only
//   - core/core_head/admin  → basic + contact fields
mentorsRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ mentors: listMentors(req.user) });
}));

// ── GET /mentors/all ──────────────────────────────────────────────────────
// Admin-only management list — includes inactive mentors, always full tier.
mentorsRouter.get(
  '/all',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    res.json({ mentors: listAllMentors() });
  }),
);

// ── GET /mentors/:id ──────────────────────────────────────────────────────
// Public — same tiering as the list endpoint.
mentorsRouter.get('/:id', asyncHandler(async (req, res) => {
  const mentor = getMentorById(req.params.id, req.user);
  if (!mentor) throw new HttpError(404, 'mentor not found');
  res.json({ mentor });
}));

// ── POST /mentors ─────────────────────────────────────────────────────────
// Admin only.
mentorsRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const mentor = createMentor(req.user, req.body || {});
    res.status(201).json({ mentor });
  }),
);

// ── PATCH /mentors/:id ────────────────────────────────────────────────────
// Admin only.
mentorsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const mentor = updateMentor(req.user, req.params.id, req.body || {});
    res.json({ mentor });
  }),
);

// ── DELETE /mentors/:id ───────────────────────────────────────────────────
// Admin only — soft-delete (sets is_active = false).
mentorsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json(deactivateMentor(req.params.id));
  }),
);
