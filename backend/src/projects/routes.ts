import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from './service.js';

export const projectsRouter = Router();

// GET /projects — public
projectsRouter.get('/', asyncHandler(async (req, res) => {
  const { category, status } = req.query;
  res.json({ projects: listProjects({ category: category ? String(category) : undefined, status: status ? String(status) : undefined }) });
}));

// GET /projects/:id — public
projectsRouter.get('/:id', asyncHandler(async (req, res) => {
  const project = getProjectById(Number(req.params.id));
  if (!project) throw new HttpError(404, 'project not found');
  res.json({ project });
}));

// POST /projects — admin only
projectsRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const project = createProject(req.user!, req.body || {});
    res.status(201).json({ project });
  }),
);

// PATCH /projects/:id — admin only
projectsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const project = updateProject(req.user!, Number(req.params.id), req.body || {});
    res.json({ project });
  }),
);

// DELETE /projects/:id — admin only
projectsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteProject(req.user!, Number(req.params.id));
    res.json({ ok: true });
  }),
);
