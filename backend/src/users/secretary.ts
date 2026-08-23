import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { db } from '../db.js';
import { publicProfile, findUserById } from '../auth/service.js';
import { canAssignPresident } from '../lib/permissions.js';
import type { UserRow } from '../lib/types.js';

export const secretaryRouter = Router();

// GET /secretary — get the current Secretary (public)
secretaryRouter.get('/', (req, res) => {
  const row = db
    .prepare<UserRow>(`SELECT * FROM users WHERE club_title = 'Secretary' LIMIT 1`)
    .get();
  res.json({ secretary: row ? publicProfile(row) : null });
});

// POST /secretary — assign a new Secretary (admin only)
// Body: { user_id: <int> }
// Atomically clears the previous Secretary and assigns the new one.
secretaryRouter.post(
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
      throw new HttpError(400, 'Secretary must have role core_head');
    }
    // Prevent holding multiple leadership titles
    if (['President', 'Vice President', 'Treasurer'].includes(target.club_title ?? '')) {
      throw new HttpError(400, `This person already holds the ${target.club_title} title — remove that first`);
    }
    const tx = db.transaction(() => {
      // Clear any existing Secretary
      db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'Secretary'`).run();
      // Assign new Secretary
      db.prepare(`UPDATE users SET club_title = 'Secretary' WHERE id = ?`).run(target.id);
    });
    tx();
    res.json({ secretary: publicProfile(findUserById(target.id)) });
  }),
);

// DELETE /secretary — remove Secretary title (admin only)
secretaryRouter.delete(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!canAssignPresident(req.user)) throw new HttpError(403, 'forbidden');
    db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'Secretary'`).run();
    res.json({ ok: true });
  }),
);
