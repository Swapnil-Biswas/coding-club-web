import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { db } from '../db.js';
import { publicProfile, findUserById } from '../auth/service.js';
import { canAssignPresident } from '../lib/permissions.js';
import type { UserRow } from '../lib/types.js';

export const treasurerRouter = Router();

// GET /treasurer — get the current Treasurer (public)
treasurerRouter.get('/', (req, res) => {
  const row = db
    .prepare<UserRow>(`SELECT * FROM users WHERE club_title = 'Treasurer' LIMIT 1`)
    .get();
  res.json({ treasurer: row ? publicProfile(row) : null });
});

// POST /treasurer — assign a new Treasurer (admin only)
// Body: { user_id: <int> }
// Atomically clears the previous Treasurer and assigns the new one.
treasurerRouter.post(
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
      throw new HttpError(400, 'Treasurer must have role core_head');
    }
    // Prevent holding multiple leadership titles
    if (['President', 'Vice President', 'Secretary'].includes(target.club_title ?? '')) {
      throw new HttpError(400, `This person already holds the ${target.club_title} title — remove that first`);
    }
    const tx = db.transaction(() => {
      // Clear any existing Treasurer
      db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'Treasurer'`).run();
      // Assign new Treasurer
      db.prepare(`UPDATE users SET club_title = 'Treasurer' WHERE id = ?`).run(target.id);
    });
    tx();
    res.json({ treasurer: publicProfile(findUserById(target.id)) });
  }),
);

// DELETE /treasurer — remove Treasurer title (admin only)
treasurerRouter.delete(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!canAssignPresident(req.user)) throw new HttpError(403, 'forbidden');
    db.prepare(`UPDATE users SET club_title = NULL WHERE club_title = 'Treasurer'`).run();
    res.json({ ok: true });
  }),
);
