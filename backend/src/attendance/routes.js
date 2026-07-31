import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth } from '../auth/middleware.js';
import {
  importRegistrants,
  listRegistrants,
  checkinByQr,
  manualCheckin,
  manualCheckinRegistrant,
  undoCheckin,
  exportAttendance,
  getMyAttendedEvents,
  getMyQrToken,
} from './service.js';
import { getEvent } from '../events/service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const attendanceRouter = Router();

// --- Import registrants from CSV (core_head, admin) -----------------------
attendanceRouter.post(
  '/events/:id/registrants/import',
  requireAuth,
  upload.single('csv'),
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    if (!req.file) throw new HttpError(400, 'csv file required (multipart field "csv")');
    const text = req.file.buffer.toString('utf-8');
    const result = importRegistrants(eventId, text, req.user);
    res.json(result);
  })
);

// --- List registrants (core_head, admin) ----------------------------------
attendanceRouter.get(
  '/events/:id/registrants',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const registrants = listRegistrants(eventId, req.user);
    res.json({ registrants });
  })
);

// --- Check-in by QR token (core, core_head, admin) ------------------------
attendanceRouter.post(
  '/events/:id/checkin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const { qr_code_token } = req.body || {};
    if (!qr_code_token) throw new HttpError(400, 'qr_code_token required');
    const result = checkinByQr(eventId, qr_code_token, req.user);
    res.json(result);
  })
);

// --- Manual check-in search (core, core_head, admin) ----------------------
attendanceRouter.get(
  '/events/:id/checkin/manual',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ registrants: [] });
    const registrants = manualCheckin(eventId, q, req.user);
    res.json({ registrants });
  })
);

// --- Manual check-in specific registrant (core, core_head, admin) ----------
attendanceRouter.post(
  '/events/:id/checkin/manual',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const { registrant_id } = req.body || {};
    if (!registrant_id) throw new HttpError(400, 'registrant_id required');
    const result = manualCheckinRegistrant(eventId, Number(registrant_id), req.user);
    res.json(result);
  })
);

// --- Undo / correct check-in (core_head, admin) ---------------------------
attendanceRouter.patch(
  '/events/:id/checkin/:registrantId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const registrantId = Number(req.params.registrantId);
    const result = undoCheckin(eventId, registrantId, req.user);
    res.json(result);
  })
);

// --- Export attendance (core_head, admin) ---------------------------------
attendanceRouter.get(
  '/events/:id/attendance/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const { csv, filename } = exportAttendance(eventId, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  })
);

// --- My attended events (any logged-in user) ------------------------------
attendanceRouter.get(
  '/users/me/attended-events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const events = getMyAttendedEvents(req.user.id);
    res.json({ events });
  })
);

// --- My QR token for an event (any logged-in user) -----------------------
attendanceRouter.get(
  '/users/me/qr-token/:eventId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.eventId);
    const qr = getMyQrToken(req.user.id, eventId);
    if (!qr) return res.json({ qr: null });
    res.json({ qr });
  })
);