import { userFromSessionId } from './service.js';
import { HttpError } from '../lib/errors.js';

export const SESSION_COOKIE = 'cc_session';

export function loadUser(req, _res, next) {
  const sid = req.cookies?.[SESSION_COOKIE];
  const user = userFromSessionId(sid);
  req.user = user ? { ...user, _sessionId: sid } : null;
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'authentication required'));
  next();
}

// Authorize by an explicit allowlist of roles. Default-deny — if you didn't
// list it, you can't pass. This is the single place role checks live for
// protected routes, so the policy is easy to audit.
export function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'authentication required'));
    if (!allowed.includes(req.user.role)) {
      return next(new HttpError(403, 'forbidden'));
    }
    next();
  };
}
