import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  admitImageUpload,
  deleteManagedImage,
  deleteManagedImageIfUnreferenced,
  imageUpload,
  requireSingleImageSource,
  saveImageFile,
  validateImageUrl,
} from '../lib/imageUpload.js';
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
  const mentor = getMentorById(Number(req.params.id), req.user);
  if (!mentor) throw new HttpError(404, 'mentor not found');
  res.json({ mentor });
}));

// ── POST /mentors ─────────────────────────────────────────────────────────
// Admin only.
mentorsRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  admitImageUpload,
  imageUpload.single('photo'),
  asyncHandler(async (req, res) => {
    const photoUrl = req.body?.photo_url;
    if (req.file && String(photoUrl ?? '').trim()) {
      requireSingleImageSource(req.file, photoUrl, 'photo_url');
    }
    const reference = req.file
      ? saveImageFile(req.file, 'mentors')
      : photoUrl
        ? validateImageUrl(photoUrl, 'photo_url')
        : null;

    try {
      const mentor = createMentor(req.user!, { ...req.body, photo_url: reference });
      res.status(201).json({ mentor });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// ── PATCH /mentors/:id ────────────────────────────────────────────────────
// Admin only.
mentorsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  admitImageUpload,
  imageUpload.single('photo'),
  asyncHandler(async (req, res) => {
    const existing = getMentorById(Number(req.params.id), req.user);
    if (!existing) throw new HttpError(404, 'mentor not found');
    const photoUrl = req.body?.photo_url;
    if (req.file && String(photoUrl ?? '').trim()) {
      requireSingleImageSource(req.file, photoUrl, 'photo_url');
    }
    const hasNewSource = Boolean(req.file || String(photoUrl ?? '').trim());
    const reference = req.file
      ? saveImageFile(req.file, 'mentors')
      : hasNewSource
        ? validateImageUrl(photoUrl, 'photo_url')
        : undefined;

    try {
      const body = reference === undefined
        ? req.body || {}
        : { ...req.body, photo_url: reference };
      const mentor = updateMentor(req.user!, Number(req.params.id), body);
      if (reference !== undefined) deleteManagedImageIfUnreferenced(existing.photo_url);
      res.json({ mentor });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// ── DELETE /mentors/:id ───────────────────────────────────────────────────
// Admin only — soft-delete (sets is_active = false).
mentorsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json(deactivateMentor(Number(req.params.id)));
  }),
);
