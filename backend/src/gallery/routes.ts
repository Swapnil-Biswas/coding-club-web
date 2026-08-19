import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  deleteManagedImage,
  uploadSingleImage,
  requireSingleImageSource,
  saveImageFile,
  validateImageUrl,
} from '../lib/imageUpload.js';
import {
  listGallery,
  getPhotoById,
  createPhoto,
  updatePhoto,
  deletePhoto,
  reorderGallery,
} from './service.js';

export const galleryRouter = Router();

// GET /gallery — public gallery view
galleryRouter.get('/', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const eventId = req.query.event_id ? Number(req.query.event_id) : undefined;
  const featured = req.query.featured ? req.query.featured === 'true' : undefined;
  res.json({ photos: listGallery({ limit, offset, eventId, featured }) });
}));

// POST /photos — upload photo (member, core, core_head, admin)
galleryRouter.post(
  '/photos',
  requireAuth,
  requireRole('member', 'core', 'core_head', 'admin'),
  uploadSingleImage('image'),
  asyncHandler(async (req, res) => {
    const imageUrl = req.body?.image_url;
    requireSingleImageSource(req.file, imageUrl, 'image_url');
    const reference = req.file
      ? await saveImageFile(req.file, 'gallery')
      : validateImageUrl(imageUrl, 'image_url');

    try {
      const photo = createPhoto(req.user!, { ...req.body, image_url: reference });
      res.status(201).json({ photo });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// PATCH /photos/:id — update photo (owner, owner core_head, President, admin)
galleryRouter.patch(
  '/photos/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const photo = updatePhoto(req.user!, req.params.id!, req.body || {});
    res.json({ photo });
  }),
);

// DELETE /photos/:id — delete photo (owner, owner core_head, President, admin)
galleryRouter.delete(
  '/photos/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deletePhoto(req.user!, req.params.id!);
    res.json({ ok: true });
  }),
);

// PATCH /gallery/reorder — reorder gallery for an event (core_head of event's team, President, admin)
galleryRouter.patch(
  '/gallery/reorder',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { event_id, ordered_ids } = req.body || {};
    if (!event_id || !Array.isArray(ordered_ids)) {
      throw new HttpError(400, 'event_id and ordered_ids array required');
    }
    const result = reorderGallery(req.user!, Number(event_id), ordered_ids);
    res.json(result);
  }),
);