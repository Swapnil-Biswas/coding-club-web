import { Router } from 'express';
import { getLeaderboard, updateLeaderboard } from './service.js';
import { requireAuth } from '../auth/middleware.js';
import { getActorFromReq } from '../lib/actor.js';

export const leaderboardsRouter = Router();

leaderboardsRouter.get('/:id/leaderboard', (req, res, next) => {
  try {
    const viewer = getActorFromReq(req);
    res.json(getLeaderboard(req.params.id, viewer));
  } catch (e) {
    next(e);
  }
});

leaderboardsRouter.post('/:id/leaderboard', requireAuth, (req, res, next) => {
  try {
    const actor = req.user;
    res.json(updateLeaderboard(actor, req.params.id, req.body || {}));
  } catch (e) {
    next(e);
  }
});