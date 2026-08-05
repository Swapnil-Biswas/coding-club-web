import type { Request } from 'express';
import type { ActorLike, SessionUser } from './types.js';

// `req.user` is set by loadUser middleware when there's a session cookie. The
// permission helpers take an "actor" object that has the right shape (id,
// role, club_title). For public routes where there may be no logged-in user,
// we still need to pass a sensible actor with role='public' so the
// permission check is consistent.
export function getActorFromReq(req: Request): SessionUser | ActorLike {
  if (req.user) return req.user;
  return { id: null, role: 'public', name: 'Guest' };
}
