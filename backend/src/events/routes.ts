import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth } from '../auth/middleware.js';
import {
  deleteManagedImage,
  deleteManagedImageIfUnreferenced,
  uploadSingleImage,
  publicImageReference,
  requireSingleImageSource,
  saveImageFile,
  validateImageUrl,
} from '../lib/imageUpload.js';
import { canManageEvent } from '../lib/permissions.js';
import { db } from '../db.js';
import { canCreateEvents } from './service.js';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  setBannerImagePath,
  getEventById,
} from './service.js';

export const eventsRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certificatesDirectory = path.resolve(__dirname, '..', '..', 'uploads', 'certificates');

// GET /events — list events visible to the current viewer.
// Logged-out visitors are fine here; the visibility filter takes care of
// hiding drafts and member-only events.
eventsRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ events: listEvents(req.user) });
}));

// GET /events/:id — same visibility rules applied via the service.
eventsRouter.get('/:id', asyncHandler(async (req, res) => {
  const event = getEvent(req.user!, Number(req.params.id));
  res.json({ event });
}));

// POST /events — gated by requireAuth + canCreateEvents (the can-create check
// also lives in the service, but bailing early avoids building payload and
// gives a clean 403 before multer/file-size limits matter).
eventsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!canCreateEvents(req.user!.role)) {
      throw new HttpError(403, 'forbidden');
    }
    const event = createEvent(req.user!, req.body || {});
    res.status(201).json({ event });
  }),
);

// PATCH /events/:id — edit any field including status. Publish/force-complete
// gating lives in the service (single source of truth).
eventsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = updateEvent(req.user!, Number(req.params.id), req.body || {});
    res.json({ event });
  }),
);

// DELETE /events/:id — hard delete. The spec's UI calls this "Archive" but
// the API surface is DELETE. Phase 1 didn't promise a separate "archived"
// state, so we don't add one. Future phases can introduce a soft-delete
// column without breaking the contract here.
eventsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = getEventById(Number(req.params.id));
    if (!event) throw new HttpError(404, 'event not found');
    const certificates = db
      .prepare<{ verification_id: string }>(
        `SELECT verification_id FROM certificates WHERE event_id = ?`,
      )
      .all(event.id);

    deleteEvent(req.user!, event.id);
    deleteManagedImageIfUnreferenced(publicImageReference(event.banner_image_path, 'events'));
    for (const certificate of certificates) {
      try {
        fs.unlinkSync(path.join(certificatesDirectory, `${certificate.verification_id}.pdf`));
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
          console.error('[certificates] failed to remove event certificate', {
            eventId: event.id,
            verificationId: certificate.verification_id,
            error,
          });
        }
      }
    }
    res.json({ ok: true });
  }),
);

eventsRouter.post(
  '/:id/banner',
  requireAuth,
  asyncHandler(async (req, _res, next) => {
    const event = getEventById(Number(req.params.id));
    if (!event) throw new HttpError(404, 'event not found');
    if (!canManageEvent(req.user, event)) throw new HttpError(403, 'forbidden');
    next();
  }),
  uploadSingleImage('banner'),
  asyncHandler(async (req, res) => {
    const event = getEventById(Number(req.params.id));
    if (!event) throw new HttpError(404, 'event not found');

    const bannerUrl = req.body?.banner_image_url;
    requireSingleImageSource(req.file, bannerUrl, 'banner_image_url');
    const previous = publicImageReference(event.banner_image_path, 'events');
    const reference = req.file
      ? await saveImageFile(req.file, 'events')
      : validateImageUrl(bannerUrl, 'banner_image_url');

    try {
      setBannerImagePath(event.id, reference);
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }

    deleteManagedImageIfUnreferenced(previous);
    res.json({ event: getEvent(req.user!, event.id) });
  }),
);
