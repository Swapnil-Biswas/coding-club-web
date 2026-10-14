import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  submitBuilderRepo,
  listBuilderRepos,
  listMyBuilderRepos,
  getBuilderRepo,
  reviewBuilderRepo,
  deleteBuilderRepo,
} from './service.js';
import type { BuilderRepoCategory, BuilderRepoStatus } from '../lib/types.js';

export const buildersRouter = Router();

// GET /builders — public (approved only). member+ can pass ?status=all to see their own too.
buildersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const actor = req.user ?? null;
    const repos = listBuilderRepos(actor, {
      status: (req.query.status as BuilderRepoStatus | 'all') || undefined,
      category: req.query.category as BuilderRepoCategory | undefined,
      seeking: req.query.seeking === '1' || req.query.seeking === 'true',
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ repos });
  }),
);

// GET /builders/my — own submissions (member+)
buildersRouter.get(
  '/my',
  requireAuth,
  requireRole('member', 'core', 'core_head', 'admin', 'faculty'),
  asyncHandler(async (req, res) => {
    const repos = listMyBuilderRepos(req.user!);
    res.json({ repos });
  }),
);

// GET /builders/:id — single repo (visibility enforced in service)
buildersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const repo = getBuilderRepo(req.user ?? null, req.params.id ?? '');
    res.json({ repo });
  }),
);

// POST /builders — submit a repo (member+)
buildersRouter.post(
  '/',
  requireAuth,
  requireRole('member', 'core', 'core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const repo = submitBuilderRepo(req.user!, req.body || {});
    res.status(201).json({ repo });
  }),
);

// PATCH /builders/:id/review — approve or reject (core_head+)
buildersRouter.patch(
  '/:id/review',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const repo = reviewBuilderRepo(req.user!, req.params.id ?? '', req.body || {});
    res.json({ repo });
  }),
);

// DELETE /builders/:id — submitter can delete their own pending; core_head+ can delete any
buildersRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    deleteBuilderRepo(req.user!, req.params.id ?? '');
    res.status(204).send();
  }),
);
