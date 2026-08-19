import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  deleteManagedImage,
  deleteManagedImageIfUnreferenced,
  uploadSingleImage,
  requireSingleImageSource,
  saveImageFile,
  validateImageUrl,
} from '../lib/imageUpload.js';
import {
  listSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  getSponsorById,
} from './service.js';

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
  uploadSingleImage('logo'),
  asyncHandler(async (req, res) => {
    const logoUrl = req.body?.logo_url;
    requireSingleImageSource(req.file, logoUrl, 'logo_url');
    const reference = req.file
      ? await saveImageFile(req.file, 'sponsors')
      : validateImageUrl(logoUrl, 'logo_url');

    try {
      const sponsor = createSponsor(req.user!, { ...req.body, logo_url: reference });
      res.status(201).json({ sponsor });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// PATCH /sponsors/:id — update
sponsorsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  uploadSingleImage('logo'),
  asyncHandler(async (req, res) => {
    const existing = getSponsorById(Number(req.params.id));
    if (!existing) throw new HttpError(404, 'sponsor not found');
    const logoUrl = req.body?.logo_url;
    if (req.file && String(logoUrl ?? '').trim()) {
      requireSingleImageSource(req.file, logoUrl, 'logo_url');
    }
    const hasNewSource = Boolean(req.file || String(logoUrl ?? '').trim());
    const reference = req.file
      ? await saveImageFile(req.file, 'sponsors')
      : hasNewSource
        ? validateImageUrl(logoUrl, 'logo_url')
        : undefined;

    try {
      const body = reference === undefined
        ? req.body || {}
        : { ...req.body, logo_url: reference };
      const sponsor = updateSponsor(req.user!, Number(req.params.id), body);
      if (reference !== undefined) deleteManagedImageIfUnreferenced(existing.logo_url);
      res.json({ sponsor });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// DELETE /sponsors/:id — delete
sponsorsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const existing = getSponsorById(Number(req.params.id));
    if (!existing) throw new HttpError(404, 'sponsor not found');
    deleteSponsor(req.user!, Number(req.params.id));
    deleteManagedImageIfUnreferenced(existing.logo_url);
    res.json({ ok: true });
  }),
);