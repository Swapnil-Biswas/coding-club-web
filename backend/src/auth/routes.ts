import { Router, type Response } from 'express';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from './middleware.js';
import {
  signup,
  verifyEmail,
  login,
  googleLogin,
  destroySession,
  publicUser,
  resendVerificationCode,
} from './service.js';

export const authRouter = Router();

function setSessionCookie(res: Response, sessionId: string, expiresAt: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(expiresAt),
  });
}

// Google OAuth — frontend sends the credential (ID token) from Google Identity Services
authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      throw new HttpError(400, 'credential (Google ID token) is required');
    }
    const { sessionId, expiresAt, user } = await googleLogin(credential);
    setSessionCookie(res, sessionId, expiresAt);
    res.json({ user });
  }),
);

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    const result = await signup({ name, email, password });
    res.status(201).json({
      id: result.id,
      email: result.email,
      message: 'Account created. Check your email for the verification code.',
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
  '/resend-verification',
  asyncHandler(async (req, res) => {
    await resendVerificationCode(req.body?.email);
    res.json({ ok: true });
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
    res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
    res.json({ ok: true });
  }),
);

// Returns 200 with {user: null} when not logged in.
authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});
