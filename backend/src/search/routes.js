import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { search } from './service.js';

export const searchRouter = Router();

searchRouter.get('/search', requireAuth, (req, res) => {
  res.json(search(req.user, req.query.q));
});
