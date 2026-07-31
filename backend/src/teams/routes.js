import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { db } from '../db.js';
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
  const team = getTeamById(req.params.id);
  if (!team) throw new HttpError(404, 'team not found');
  res.json({ team: publicTeam(team), members: publicTeamMembers(req.params.id) });
}));

// POST /teams — create team (core_head, President, admin)
teamsRouter.post(
  '/',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const team = createTeam(req.user, req.body || {});
    res.status(201).json({ team });
  }),
);

// PATCH /teams/:id — update team (owner core_head, President, admin)
teamsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const team = updateTeam(req.user, req.params.id, req.body || {});
    res.json({ team });
  }),
);

// DELETE /teams/:id — delete team (owner core_head, President, admin)
teamsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    await deleteTeam(req.user, req.params.id);
    res.json({ ok: true });
  }),
);

// GET /teams/:id/members — public team members
teamsRouter.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const team = getTeamById(req.params.id);
    if (!team) throw new HttpError(404, 'team not found');
    res.json({ members: publicTeamMembers(req.params.id) });
  }),
);

// GET /teams/:id/dashboard — team dashboard (owner core_head, President, admin)
teamsRouter.get(
  '/:id/dashboard',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const data = getTeamDashboard(req.user, req.params.id);
    res.json(data);
  }),
);

// POST /teams/:id/members — add member (owner core_head, President, admin)
teamsRouter.post(
  '/:id/members',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const member = addTeamMember(req.user, req.params.id, req.body || {});
    res.status(201).json({ member });
  }),
);

// PATCH /teams/:id/members/:userId — update member (owner core_head, President, admin)
teamsRouter.patch(
  '/:id/members/:userId',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const member = updateTeamMember(req.user, req.params.id, req.params.userId, req.body || {});
    res.json({ member });
  }),
);

// DELETE /teams/:id/members/:userId — remove member (owner core_head, President, admin)
teamsRouter.delete(
  '/:id/members/:userId',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    await removeTeamMember(req.user, req.params.id, req.params.userId);
    res.json({ ok: true });
  }),
);

// GET /users/:id/teams — public teams a user belongs to
teamsRouter.get(
  '/users/:id/teams',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(userId);
    if (!exists) throw new HttpError(404, 'user not found');
    res.json({ teams: getTeamsForUser(userId) });
  }),
);