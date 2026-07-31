import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  submitJoinRequest,
  listJoinRequests,
  updateJoinRequest,
} from './service.js';

export const joinRequestsRouter = Router();

// POST /join-requests — public submission
joinRequestsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const reqData = submitJoinRequest(req.body || {});
    res.status(201).json({ joinRequest: reqData });
  }),
);

// GET /join-requests — list all (core_head, President, admin)
joinRequestsRouter.get(
  '/',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const reqs = listJoinRequests(req.user);
    res.json({ joinRequests: reqs });
  }),
);

// PATCH /join-requests/:id — update status/notes (core_head, President, admin)
joinRequestsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const reqData = updateJoinRequest(req.user, req.params.id, req.body || {});
    res.json({ joinRequest: reqData });
  }),
);