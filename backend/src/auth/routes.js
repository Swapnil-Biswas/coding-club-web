import { Router } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { SESSION_COOKIE } from './middleware.js';
import {
  signup,
  verifyEmail,
  login,
  destroySession,
  publicUser,
} from './service.js';

export const authRouter = Router();

function setSessionCookie(res, sessionId, expiresAt) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/',
  });
}

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    const result = await signup({ name, email, password });
    res.status(201).json({
      id: result.id,
      email: result.email,
      message: 'Account created. Check the backend console for the verification code.',
    });
  }),
);

authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) throw new HttpError(400, 'email and code are required');
    const user = await verifyEmail({ email, code });
    res.json({ user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const { sessionId, expiresAt, user } = await login({ email, password });
    setSessionCookie(res, sessionId, expiresAt);
    res.json({ user });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.user?._sessionId) {
      destroySession(req.user._sessionId);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  }),
);

// Useful for the frontend to figure out who's logged in on initial load.
// Returns 200 with {user: null} when not logged in, so the frontend doesn't
// have to special-case the response shape.
authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});
