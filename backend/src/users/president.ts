import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { db } from '../db.js';
import { publicProfile, findUserById } from '../auth/service.js';
import { canAssignPresident } from '../lib/permissions.js';
import type { UserRow } from '../lib/types.js';

export const presidentRouter = Router();

// GET /president — get the current President (public)
presidentRouter.get('/', (req, res) => {
  const row = db
    .prepare<UserRow>(`SELECT * FROM users WHERE club_title = 'President' LIMIT 1`)
    .get();
  res.json({ president: row ? publicProfile(row) : null });
});

// POST /president — assign a new President (admin only)
// Body: { user_id: <int> }
// This atomically clears the previous President and assigns the new one.
presidentRouter.post(
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
      throw new HttpError(400, 'President must have role core_head');
    }
    const tx = db.transaction(() => {
      // Clear any existing President
      db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'President'`).run();
      // Assign new President
      db.prepare(`UPDATE users SET club_title = 'President' WHERE id = ?`).run(target.id);
    });
    tx();
    res.json({ president: publicProfile(findUserById(target.id)) });
  }),
);

// DELETE /president — remove President (admin only)
presidentRouter.delete(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!canAssignPresident(req.user)) throw new HttpError(403, 'forbidden');
    db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'President'`).run();
    res.json({ ok: true });
  }),
);