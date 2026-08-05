import { Router } from 'express';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from './service.js';
import { requireAuth } from '../auth/middleware.js';
import { getActorFromReq } from '../lib/actor.js';

export const announcementsRouter = Router();

announcementsRouter.get('/:id/announcements', (req, res, next) => {
  try {
    const viewer = getActorFromReq(req);
    res.json(listAnnouncements(req.params.id!, viewer));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.post('/:id/announcements', requireAuth, (req, res, next) => {
  try {
    const actor = req.user!;
    res.json(createAnnouncement(actor, req.params.id!, req.body || {}));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.delete('/announcements/:id', requireAuth, (req, res, next) => {
  try {
    const actor = req.user!;
    res.json(deleteAnnouncement(actor, req.params.id!));
  } catch (e) {
    next(e);
  }
});