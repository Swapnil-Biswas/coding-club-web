import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from 'express';
import { userFromSessionId } from './service.js';
import { HttpError } from '../lib/errors.js';
import type { Role } from '../lib/types.js';

export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-cc_session' : 'cc_session';

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function loadUser(req: Request, _res: Response, next: NextFunction): void {
  const sid: string | undefined = req.cookies?.[SESSION_COOKIE];
  const user = userFromSessionId(sid);
  req.user = user ? { ...user, _sessionId: sid } : null;
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new HttpError(401, 'authentication required'));
    return;
  }
  next();
}

// Authorize by an explicit allowlist of roles. Default-deny — if you didn't
// list it, you can't pass. This is the single place role checks live for
// protected routes, so the policy is easy to audit.
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, 'authentication required'));
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(new HttpError(403, 'forbidden'));
      return;
    }
    next();
  };
}
