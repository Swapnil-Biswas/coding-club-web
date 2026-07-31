import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { listNotifications, markRead, markAllRead, unreadCount } from './service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/me/notifications', requireAuth, (req, res) => {
  res.json(listNotifications(req.user.id));
});

notificationsRouter.get('/me/notifications/unread-count', requireAuth, (req, res) => {
  res.json({ count: unreadCount(req.user.id) });
});

notificationsRouter.post('/me/notifications/:id/read', requireAuth, (req, res) => {
  res.json(markRead(req.user.id, req.params.id));
});

notificationsRouter.post('/me/notifications/mark-all-read', requireAuth, (req, res) => {
  res.json(markAllRead(req.user.id));
});
