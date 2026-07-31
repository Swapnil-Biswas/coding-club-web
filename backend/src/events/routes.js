import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth } from '../auth/middleware.js';
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
import { upload, uploadsDir } from './uploads.js';

export const eventsRouter = Router();

// GET /events — list events visible to the current viewer.
// Logged-out visitors are fine here; the visibility filter takes care of
// hiding drafts and member-only events.
eventsRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ events: listEvents(req.user) });
}));

// GET /events/:id — same visibility rules applied via the service.
eventsRouter.get('/:id', asyncHandler(async (req, res) => {
  const event = getEvent(req.user, req.params.id);
  res.json({ event });
}));

// POST /events — gated by requireAuth + canCreateEvents (the can-create check
// also lives in the service, but bailing early avoids building payload and
// gives a clean 403 before multer/file-size limits matter).
eventsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!canCreateEvents(req.user.role)) {
      throw new HttpError(403, 'forbidden');
    }
    const event = createEvent(req.user, req.body || {});
    res.status(201).json({ event });
  }),
);

// PATCH /events/:id — edit any field including status. Publish/force-complete
// gating lives in the service (single source of truth).
eventsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = updateEvent(req.user, req.params.id, req.body || {});
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
    deleteEvent(req.user, req.params.id);
    res.json({ ok: true });
  }),
);

// POST /events/:id/banner — multipart upload, field name "banner". Requires
// create permission (anyone who can create can edit, per spec).
eventsRouter.post(
  '/:id/banner',
  requireAuth,
  upload.single('banner'),
  asyncHandler(async (req, res) => {
    if (!canCreateEvents(req.user.role)) {
      throw new HttpError(403, 'forbidden');
    }
    const event = getEventById(req.params.id);
    if (!event) throw new HttpError(404, 'event not found');

    if (!req.file) throw new HttpError(400, 'banner file is required (field name "banner")');

    const ext = path.extname(req.file.filename).slice(1);
    const finalName = `${event.id}.${ext}`;
    const finalPath = path.join(uploadsDir, finalName);

    try {
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    } catch {
      // ignore — fall through to copy/unlink below
    }
    try {
      fs.renameSync(req.file.path, finalPath);
    } catch {
      fs.copyFileSync(req.file.path, finalPath);
      fs.unlinkSync(req.file.path);
    }

    setBannerImagePath(event.id, finalName);
    const updated = getEventById(event.id);
    res.json({
      event: {
        ...updated,
        banner_image_url: `/uploads/events/${finalName}`,
      },
    });
  }),
);
