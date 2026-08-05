import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import {
  requireAuth,
  requireRole,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '../auth/middleware.js';
import { publicProfile, publicUser, findUserById, changePassword } from '../auth/service.js';
import {
  admitImageUpload,
  deleteManagedImage,
  deleteManagedImageIfUnreferenced,
  imageUpload,
  publicImageReference,
  requireSingleImageSource,
  saveImageFile,
  validateImageUrl,
} from '../lib/imageUpload.js';
import { listUsers, changeUserRole, setProfilePhotoPath } from './service.js';

export const usersRouter = Router();

// Anyone logged in can read their own profile.
usersRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// member and above, plus faculty observers, can view the members list.
// The transition matrix in service.js enforces what each role can actually do.
usersRouter.get('/', requireAuth, requireRole('member', 'core', 'core_head', 'admin', 'faculty'), (req, res) => {
  const users = req.user!.role === 'admin' ? listUsers(true) : listUsers(false);
  res.json({ users });
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
      actor: req.user!,
      targetUserId: Number(req.params.id),
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
    if (targetId === req.user!.id) {
      throw new HttpError(403, 'You cannot delete your own account');
    }
    const target = findUserById(targetId);
    if (!target) throw new HttpError(404, 'user not found');

    // Several tables use ON DELETE RESTRICT which blocks a plain DELETE.
    // Nullify those FK columns first inside a single transaction, then remove
    // the user row. Tables with ON DELETE CASCADE / SET NULL handle themselves.
    const { db } = await import('../db.js');
    const managedImages = [
      publicImageReference(target.profile_photo_path),
      ...db
        .prepare<{ image_url: string }>(`SELECT image_url FROM photos WHERE uploaded_by = ?`)
        .all(targetId)
        .map((photo) => photo.image_url),
    ];
    db.transaction(() => {
      // self-referential: users promoted by this user
      db.prepare(`UPDATE users SET promoted_by = NULL WHERE promoted_by = ?`).run(targetId);
      // events they organised — reassign to the acting admin (organizer_id is NOT NULL)
      db.prepare(`UPDATE events SET organizer_id = ? WHERE organizer_id = ?`).run(req.user!.id, targetId);
      // teams they own — reassign ownership to the acting admin so the team isn't orphaned
      db.prepare(`UPDATE teams SET owner_core_head_id = ? WHERE owner_core_head_id = ?`).run(req.user!.id, targetId);
      // certificate templates they created (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE certificate_templates SET created_by = ? WHERE created_by = ?`).run(req.user!.id, targetId);
      // certificates they generated (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE certificates SET generated_by = ? WHERE generated_by = ?`).run(req.user!.id, targetId);
      // leaderboard rows they last updated (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE leaderboards SET updated_by = ? WHERE updated_by = ?`).run(req.user!.id, targetId);
      // announcements they posted (NOT NULL — reassign to acting admin)
      db.prepare(`UPDATE announcements SET posted_by = ? WHERE posted_by = ?`).run(req.user!.id, targetId);
      // now the user row can be safely removed (CASCADE / SET NULL handle the rest)
      db.prepare(`DELETE FROM users WHERE id = ?`).run(targetId);
    })();
    new Set(managedImages).forEach(deleteManagedImageIfUnreferenced);

    res.json({ ok: true });
  }),
);

usersRouter.post(
  '/me/photo',
  requireAuth,
  admitImageUpload,
  imageUpload.single('photo'),
  asyncHandler(async (req, res) => {
    const photoUrl = req.body?.photo_url;
    requireSingleImageSource(req.file, photoUrl, 'photo_url');

    const previous = publicImageReference(req.user!.profile_photo_path);
    const reference = req.file
      ? saveImageFile(req.file, 'profiles')
      : validateImageUrl(photoUrl, 'photo_url');

    try {
      setProfilePhotoPath(req.user!.id, reference);
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }

    deleteManagedImageIfUnreferenced(previous);
    res.json({ user: publicUser(findUserById(req.user!.id)) });
  }),
);

usersRouter.post(
  '/me/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    await changePassword(req.user!.id, { currentPassword, newPassword });
    res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
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
    res.json({ user: publicProfile(user) });
  }),
);
