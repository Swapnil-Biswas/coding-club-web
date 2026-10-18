// Recruitment Express routes.
// Mounted at /recruitment in index.ts.

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  getRecruitmentState,
  openRecruitment,
  closeRecruitment,
  getAdminCycleDetail,
  submitApplication,
  getMyApplications,
  listApplications,
  getApplicationDetail,
  updateApplicationStatus,
  exportApplicationsCsv,
  getSyncHealth,
  retryFailedSyncItems,
  getFileStorageKey,
} from './service.js';
import { reconcileSheets } from './sheets-worker.js';
import {
  ALLOWED_DESIGN_MIME_TYPES,
  ALLOWED_DESIGN_EXTENSIONS,
  MAX_DESIGN_FILE_SIZE,
  type ApplicationStatus,
  type RecruitmentTeam,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Upload storage ────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'recruitment');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Store with opaque random filename; never use user-supplied name as path.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_DESIGN_EXTENSIONS.has(ext) || !ALLOWED_DESIGN_MIME_TYPES.has(file.mimetype)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'design_file'));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_DESIGN_FILE_SIZE, files: 1 },
  fileFilter,
});

function computeChecksum(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export const recruitmentRouter = Router();

// ─── Public: get recruitment open/closed state ────────────────────────────────

recruitmentRouter.get(
  '/state',
  asyncHandler(async (_req, res) => {
    const state = getRecruitmentState();
    res.json({ recruitment: state });
  }),
);

// ─── Public: submit application (with optional file upload) ───────────────────

recruitmentRouter.post(
  '/apply',
  upload.single('design_file'),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;

    // Parse team_responses from JSON string if sent as form-data
    if (typeof body.team_responses === 'string') {
      try { body.team_responses = JSON.parse(body.team_responses); } catch { /* leave as-is */ }
    }

    let fileKey: string | undefined;
    let fileId: string | undefined;
    let fileMeta: Parameters<typeof submitApplication>[0]['fileMeta'];

    if (req.file) {
      // Compute checksum for integrity / backup verification
      const checksum = computeChecksum(req.file.path);
      fileId = crypto.randomUUID();
      fileKey = path.relative(
        path.resolve(__dirname, '..', '..'),
        req.file.path,
      ).replace(/\\/g, '/');
      fileMeta = {
        original_name: path.basename(req.file.originalname).slice(0, 200),
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        checksum_sha256: checksum,
      };
    }

    const result = submitApplication({ body, fileKey, fileId, fileMeta });
    res.status(201).json({ success: true, ...result });
  }),
);

// ─── Public: look up my applications by email (+ optional USN) ───────────────
// This endpoint is intentionally unauthenticated so that users who applied
// without an account can also check their status by providing their email.
// When the caller is logged in we ALSO accept their session email automatically.

recruitmentRouter.get(
  '/my-applications',
  asyncHandler(async (req, res) => {
    const state = getRecruitmentState();
    if (!state) {
      res.json({ applications: [] });
      return;
    }

    // Prefer logged-in user's email; otherwise fall back to ?email= query param
    const sessionEmail = (req as { user?: { email?: string } }).user?.email ?? '';
    const queryEmail = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    const lookupEmail = sessionEmail || queryEmail;

    if (!lookupEmail) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const queryUsn = typeof req.query.usn === 'string' ? req.query.usn.trim() : undefined;
    const apps = getMyApplications(state.cycle_id, lookupEmail, queryUsn);
    res.json({ applications: apps });
  }),
);

// ─── Admin: get cycle detail & stats ─────────────────────────────────────────

recruitmentRouter.get(
  '/admin/cycle',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const detail = getAdminCycleDetail(req.user!);
    res.json(detail);
  }),
);

// ─── Admin: open recruitment ──────────────────────────────────────────────────

recruitmentRouter.post(
  '/admin/open',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    openRecruitment(req.user!);
    res.json({ success: true, message: 'Recruitment opened.' });
  }),
);

// ─── Admin: close recruitment ─────────────────────────────────────────────────

recruitmentRouter.post(
  '/admin/close',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    closeRecruitment(req.user!);
    res.json({ success: true, message: 'Recruitment closed.' });
  }),
);

// ─── Admin: list applications (paginated, filterable) ─────────────────────────

recruitmentRouter.get(
  '/admin/applications',
  requireAuth,
  requireRole('core', 'core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const result = listApplications(req.user!, {
      cycleId: q.cycle_id || '2026-27',
      team: q.team as RecruitmentTeam | undefined,
      status: q.status as ApplicationStatus | undefined,
      year: q.year,
      branch: q.branch,
      search: q.search?.slice(0, 100),
      page: q.page ? Number(q.page) : 1,
      pageSize: Math.min(Number(q.page_size ?? 25), 100),
    });
    res.json(result);
  }),
);

// ─── Admin: get single application ────────────────────────────────────────────

recruitmentRouter.get(
  '/admin/applications/:id',
  requireAuth,
  requireRole('core', 'core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const app = getApplicationDetail(req.user!, req.params.id ?? '');
    res.json({ application: app });
  }),
);

// ─── Admin: update application status ────────────────────────────────────────

recruitmentRouter.patch(
  '/admin/applications/:id/status',
  requireAuth,
  requireRole('core', 'core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const body = req.body as { status: ApplicationStatus; reason?: string };
    updateApplicationStatus(
      req.user!,
      req.params.id ?? '',
      body.status,
      body.reason ?? '',
    );
    res.json({ success: true });
  }),
);

// ─── Admin: CSV export ────────────────────────────────────────────────────────

recruitmentRouter.get(
  '/admin/export/csv',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const cycleId = (req.query.cycle_id as string) || '2026-27';
    const csv = exportApplicationsCsv(req.user!, cycleId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recruitment-${cycleId}-${Date.now()}.csv"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);
  }),
);

// ─── Admin: sync health ───────────────────────────────────────────────────────

recruitmentRouter.get(
  '/admin/sync-health',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (_req, res) => {
    res.json({ sync_health: getSyncHealth() });
  }),
);

// ─── Admin: retry failed sync ─────────────────────────────────────────────────

recruitmentRouter.post(
  '/admin/sync-retry',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const result = retryFailedSyncItems(req.user!);
    res.json({ success: true, ...result });
  }),
);

// ─── Admin: reconcile sheets ──────────────────────────────────────────────────

recruitmentRouter.post(
  '/admin/reconcile',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (_req, res) => {
    const result = await reconcileSheets();
    res.json({ success: true, ...result });
  }),
);

// ─── Admin: download uploaded file (authenticated, authorized) ────────────────

recruitmentRouter.get(
  '/admin/files/:fileId/download',
  requireAuth,
  requireRole('core', 'core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const storageKey = getFileStorageKey(req.user!, req.params.fileId ?? '');
    const absolutePath = path.resolve(__dirname, '..', '..', storageKey);

    if (!absolutePath.startsWith(path.resolve(__dirname, '..', '..', 'uploads'))) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ error: 'file not found' });
      return;
    }

    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(absolutePath);
  }),
);
