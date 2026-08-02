import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { publicUser, findUserById, changePassword } from '../auth/service.js';
import { listUsers, changeUserRole, setProfilePhotoPath } from './service.js';
import { upload, uploadsDir } from './uploads.js';

export const usersRouter = Router();

// Anyone logged in can read their own profile.
usersRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// member and above can view the members list. Core is view-only (no promotions).
// The transition matrix in service.js enforces what each role can actually do.
usersRouter.get('/', requireAuth, requireRole('member', 'core', 'core_head', 'admin'), (_req, res) => {
  res.json({ users: listUsers() });
});

// PATCH /users/:id/role. The transition matrix in service.js is the single
// source of truth — keep it that way. If you add a transition, add it there.
usersRouter.patch(
  '/:id/role',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const { role } = req.body || {};
    if (!role) throw new HttpError(400, 'role is required');

    const user = await changeUserRole({
      actor: req.user,
      targetUserId: req.params.id,
      newRole: role,
    });
    res.json({ user });
  }),
);

// DELETE /users/:id — admin only. Cannot delete yourself.
usersRouter.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      throw new HttpError(403, 'You cannot delete your own account');
    }
    const target = findUserById(targetId);
    if (!target) throw new HttpError(404, 'user not found');

    // Several tables use ON DELETE RESTRICT which blocks a plain DELETE.
    // Nullify those FK columns first inside a single transaction, then remove
    // the user row. Tables with ON DELETE CASCADE / SET NULL handle themselves.
    const { db } = await import('../db.js');
    db.transaction(() => {
      // self-referential: users promoted by this user
      db.prepare(`UPDATE users SET promoted_by = NULL WHERE promoted_by = ?`).run(targetId);
      // events they organised — reassign to the acting admin (organizer_id is NOT NULL)
      db.prepare(`UPDATE events SET organizer_id = ? WHERE organizer_id = ?`).run(req.user.id, targetId);
      // teams they own — reassign ownership to the acting admin so the team isn't orphaned
      db.prepare(`UPDATE teams SET owner_core_head_id = ? WHERE owner_core_head_id = ?`).run(req.user.id, targetId);
      // certificate templates they created (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE certificate_templates SET created_by = ? WHERE created_by = ?`).run(req.user.id, targetId);
      // certificates they generated (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE certificates SET generated_by = ? WHERE generated_by = ?`).run(req.user.id, targetId);
      // leaderboard rows they last updated (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE leaderboards SET updated_by = ? WHERE updated_by = ?`).run(req.user.id, targetId);
      // announcements they posted (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE announcements SET posted_by = ? WHERE posted_by = ?`).run(req.user.id, targetId);
      // now the user row can be safely removed (CASCADE / SET NULL handle the rest)
      db.prepare(`DELETE FROM users WHERE id = ?`).run(targetId);
    })();

    res.json({ ok: true });
  }),
);

// Profile photo upload. Multipart form field name is "photo". We accept the
// multer-written file and rename it to <userId>.<ext> so the URL is stable.
usersRouter.post(
  '/me/photo',
  requireAuth,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'photo file is required (field name "photo")');

    const ext = path.extname(req.file.filename).slice(1);
    const finalName = `${req.user.id}.${ext}`;
    const finalPath = path.join(uploadsDir, finalName);

    // Remove any old photo file for this user before renaming, otherwise the
    // fs.renameSync below fails on Windows if the target exists.
    try {
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    } catch {
      // Non-fatal: we'll just overwrite via copy+unlink below if rename fails.
    }

    try {
      fs.renameSync(req.file.path, finalPath);
    } catch {
      // Windows can hold a brief lock on the temp file; fall back to copy+unlink.
      fs.copyFileSync(req.file.path, finalPath);
      fs.unlinkSync(req.file.path);
    }

    setProfilePhotoPath(req.user.id, finalName);
    res.json({ user: publicUser(findUserById(req.user.id)) });
  }),
);

usersRouter.post(
  '/me/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    await changePassword(req.user.id, { currentPassword, newPassword });
    res.json({ ok: true });
  }),
);

// GET /users/:id — public profile for core/core_head/admin only
usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = findUserById(Number(req.params.id));
    if (!user) throw new HttpError(404, 'user not found');
    const publicRoles = ['core', 'core_head', 'admin'];
    if (!publicRoles.includes(user.role)) {
      throw new HttpError(404, 'user not found');
    }
    res.json({ user: publicUser(user) });
  }),
);
