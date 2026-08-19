import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { db } from '../db.js';
import {
  deleteManagedImage,
  deleteManagedImageIfUnreferenced,
  uploadSingleImage,
  requireSingleImageSource,
  saveImageFile,
  validateImageUrl,
} from '../lib/imageUpload.js';
import {
  listTeams,
  getTeamById,
  publicTeam,
  publicTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  getTeamsForUser,
} from './service.js';
import { getTeamDashboard } from './dashboard.js';

export const teamsRouter = Router();

// GET /teams — public list of teams
teamsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ teams: listTeams() });
}));

// GET /teams/:id — public team detail with members
teamsRouter.get('/:id', asyncHandler(async (req, res) => {
  const team = getTeamById(req.params.id!);
  if (!team) throw new HttpError(404, 'team not found');
  res.json({ team: publicTeam(team), members: publicTeamMembers(req.params.id!) });
}));

// POST /teams — create team (core_head, President, admin)
teamsRouter.post(
  '/',
  requireAuth,
  requireRole('core_head', 'admin'),
  uploadSingleImage('logo'),
  asyncHandler(async (req, res) => {
    const logoUrl = req.body?.logo_url;
    if (req.file && String(logoUrl ?? '').trim()) {
      requireSingleImageSource(req.file, logoUrl, 'logo_url');
    }
    const reference = req.file
      ? await saveImageFile(req.file, 'teams')
      : logoUrl
        ? validateImageUrl(logoUrl, 'logo_url')
        : null;

    try {
      const team = createTeam(req.user!, { ...req.body, logo_url: reference });
      res.status(201).json({ team });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// PATCH /teams/:id — update team (owner core_head, President, admin)
teamsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  uploadSingleImage('logo'),
  asyncHandler(async (req, res) => {
    const existing = getTeamById(req.params.id!);
    if (!existing) throw new HttpError(404, 'team not found');
    const logoUrl = req.body?.logo_url;
    if (req.file && String(logoUrl ?? '').trim()) {
      requireSingleImageSource(req.file, logoUrl, 'logo_url');
    }
    const hasNewSource = Boolean(req.file || String(logoUrl ?? '').trim());
    const reference = req.file
      ? await saveImageFile(req.file, 'teams')
      : hasNewSource
        ? validateImageUrl(logoUrl, 'logo_url')
        : undefined;

    try {
      const body = reference === undefined
        ? req.body || {}
        : { ...req.body, logo_url: reference };
      const team = updateTeam(req.user!, req.params.id!, body);
      if (reference !== undefined) deleteManagedImageIfUnreferenced(existing.logo_url);
      res.json({ team });
    } catch (error) {
      if (req.file) deleteManagedImage(reference);
      throw error;
    }
  }),
);

// DELETE /teams/:id — delete team (owner core_head, President, admin)
teamsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const existing = getTeamById(req.params.id!);
    if (!existing) throw new HttpError(404, 'team not found');
    await deleteTeam(req.user!, req.params.id!);
    deleteManagedImageIfUnreferenced(existing.logo_url);
    res.json({ ok: true });
  }),
);

// GET /teams/:id/members — public team members
teamsRouter.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const team = getTeamById(req.params.id!);
    if (!team) throw new HttpError(404, 'team not found');
    res.json({ members: publicTeamMembers(req.params.id!) });
  }),
);

// GET /teams/:id/dashboard — team dashboard (owner core_head, President, admin)
teamsRouter.get(
  '/:id/dashboard',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const data = getTeamDashboard(req.user!, req.params.id!);
    res.json(data);
  }),
);

// POST /teams/:id/members — add member (owner core_head, President, admin)
teamsRouter.post(
  '/:id/members',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const member = addTeamMember(req.user!, req.params.id!, req.body || {});
    res.status(201).json({ member });
  }),
);

// PATCH /teams/:id/members/:userId — update member (owner core_head, President, admin)
teamsRouter.patch(
  '/:id/members/:userId',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const member = updateTeamMember(req.user!, req.params.id!, req.params.userId!, req.body || {});
    res.json({ member });
  }),
);

// DELETE /teams/:id/members/:userId — remove member (owner core_head, President, admin)
teamsRouter.delete(
  '/:id/members/:userId',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    await removeTeamMember(req.user!, req.params.id!, req.params.userId!);
    res.json({ ok: true });
  }),
);

// GET /users/:id/teams — public teams a user belongs to
teamsRouter.get(
  '/users/:id/teams',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id!);
    const exists = db.prepare<{ id: number }>(`SELECT id FROM users WHERE id = ?`).get(userId);
    if (!exists) throw new HttpError(404, 'user not found');
    res.json({ teams: getTeamsForUser(userId) });
  }),
);