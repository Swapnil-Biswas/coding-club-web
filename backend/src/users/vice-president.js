import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { db } from '../db.js';
import { publicUser, findUserById } from '../auth/service.js';
import { canAssignPresident } from '../lib/permissions.js';

export const vicePresidentRouter = Router();

// GET /vice-president — get the current Vice President (public)
vicePresidentRouter.get('/', (req, res) => {
  const row = db
    .prepare(`SELECT * FROM users WHERE club_title = 'Vice President' LIMIT 1`)
    .get();
  res.json({ vicePresident: row ? publicUser(row) : null });
});

// POST /vice-president — assign a new Vice President (admin only)
// Body: { user_id: <int> }
// Atomically clears the previous VP and assigns the new one.
vicePresidentRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!canAssignPresident(req.user)) throw new HttpError(403, 'forbidden');
    const { user_id } = req.body || {};
    if (!user_id) throw new HttpError(400, 'user_id is required');
    const target = findUserById(Number(user_id));
    if (!target) throw new HttpError(404, 'user not found');
    if (target.role !== 'core_head') {
      throw new HttpError(400, 'Vice President must have role core_head');
    }
    // A core_head can't be both President and VP simultaneously
    if (target.club_title === 'President') {
      throw new HttpError(400, 'This person is already the President — remove that title first');
    }
    const tx = db.transaction(() => {
      // Clear any existing Vice President
      db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'Vice President'`).run();
      // Assign new Vice President
      db.prepare(`UPDATE users SET club_title = 'Vice President' WHERE id = ?`).run(target.id);
    });
    tx();
    res.json({ vicePresident: publicUser(findUserById(target.id)) });
  }),
);

// DELETE /vice-president — remove Vice President title (admin only)
vicePresidentRouter.delete(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!canAssignPresident(req.user)) throw new HttpError(403, 'forbidden');
    db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'Vice President'`).run();
    res.json({ ok: true });
  }),
);
