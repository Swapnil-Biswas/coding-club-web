import 'dotenv/config';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authRouter } from './auth/routes.js';
import { usersRouter } from './users/routes.js';
import { presidentRouter } from './users/president.js';
import { vicePresidentRouter } from './users/vice-president.js';
import { eventsRouter } from './events/routes.js';
import { attendanceRouter } from './attendance/routes.js';
import { teamsRouter } from './teams/routes.js';
import { galleryRouter } from './gallery/routes.js';
import { sponsorsRouter } from './sponsors/routes.js';
import { joinRequestsRouter } from './join-requests/routes.js';
import { aboutRouter } from './about/routes.js';
import { eventHistoryRouter } from './event-history/routes.js';
import { certificatesRouter } from './certificates/routes.js';
import { leaderboardsRouter } from './leaderboards/routes.js';
import { announcementsRouter } from './announcements/routes.js';
import { notificationsRouter } from './notifications/routes.js';
import { analyticsRouter } from './analytics/routes.js';
import { activityLogRouter } from './activity-log/routes.js';
import { searchRouter } from './search/routes.js';
import { projectsRouter } from './projects/routes.js';
import { mentorsRouter } from './mentors/routes.js';
import { HttpError } from './lib/errors.js';
import { loadUser, SESSION_COOKIE } from './auth/middleware.js';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

function requiredProductionValue(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /change-me|placeholder|yourdomain|example\.edu|re_your_/i.test(value)) {
    throw new Error(`${name} must be configured for production`);
  }
  return value;
}

if (isProduction) {
  const sessionSecret = requiredProductionValue('SESSION_SECRET');
  const verificationSecret = requiredProductionValue('VERIFICATION_CODE_SECRET');
  if (sessionSecret.length < 32 || verificationSecret.length < 32) {
    throw new Error('Production secrets must contain at least 32 characters');
  }
  if (sessionSecret === verificationSecret) {
    throw new Error('SESSION_SECRET and VERIFICATION_CODE_SECRET must be different');
  }

  requiredProductionValue('RESEND_API_KEY');
  const sender = requiredProductionValue('RESEND_FROM_EMAIL');
  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(sender.replace(/^.*<([^>]+)>$/, '$1'))) {
    throw new Error('RESEND_FROM_EMAIL must contain a valid email address');
  }

  const domains = requiredProductionValue('ALLOWED_EMAIL_DOMAIN')
    .split(',')
    .map((domain) => domain.trim());
  if (domains.some((domain) => !/^@[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))) {
    throw new Error('ALLOWED_EMAIL_DOMAIN must contain valid @domain entries');
  }
}

const trustedProxyCidrs = (process.env.TRUST_PROXY_CIDRS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (isProduction && trustedProxyCidrs.length === 0) {
  throw new Error('TRUST_PROXY_CIDRS must list the production reverse proxies');
}
app.set('trust proxy', trustedProxyCidrs.length === 0 ? false : trustedProxyCidrs);

const appOrigin = process.env.APP_ORIGIN?.trim() ?? (isProduction ? '' : 'http://localhost:3000');
if (!appOrigin) {
  throw new Error('APP_ORIGIN is required in production');
}
const configuredOrigins = process.env.CORS_ORIGIN ?? (isProduction ? '' : 'http://localhost:5173');
const allowedOrigins = Array.from(new Set([
  appOrigin,
  ...configuredOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
]));
for (const origin of allowedOrigins) {
  const parsed = new URL(origin);
  if (parsed.origin !== origin || (isProduction && parsed.protocol !== 'https:')) {
    throw new Error(`Invalid CORS_ORIGIN entry: ${origin}`);
  }
  if (isProduction && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('CORS_ORIGIN cannot contain localhost in production');
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin (no Origin header) and Vite dev server are both fine.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new HttpError(403, 'origin not allowed'));
    },
    credentials: true,
  }),
);

const earlyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please slow down.' },
});
app.use(earlyLimiter);
app.use(express.json({ limit: '256kb' }));

// Tight limiter for auth endpoints (brute-force + OTP abuse prevention).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts, please try again in 15 minutes.' },
});

const authAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'test' ||
    typeof req.body?.email !== 'string' ||
    req.body.email.trim() === '',
  keyGenerator: (req) =>
    crypto
      .createHash('sha256')
      .update(String(req.body?.email).trim().toLowerCase())
      .digest('hex'),
  message: { error: 'Too many attempts, please try again in 15 minutes.' },
});

// Looser limiter for the rest of the API (DoS mitigation).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please slow down.' },
});

// Auth endpoints get the tight limiter
app.use('/auth/login', authLimiter, authAccountLimiter);
app.use('/auth/signup', authLimiter, authAccountLimiter);
app.use('/auth/verify-email', authLimiter, authAccountLimiter);
app.use('/auth/resend-verification', authLimiter, authAccountLimiter);
app.use('/join-requests', rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many join requests, please try again later.' },
}));

// General limiter on everything else
app.use(apiLimiter);

app.use(cookieParser());
app.use((req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.cookies?.[SESSION_COOKIE]) {
    const source = req.get('origin') || req.get('referer');
    if (!source) return next(new HttpError(403, 'request origin required'));
    let origin: string;
    try {
      origin = new URL(source).origin;
    } catch {
      return next(new HttpError(403, 'invalid request origin'));
    }
    if (origin !== appOrigin) return next(new HttpError(403, 'request origin not allowed'));
  }
  next();
});
app.use(loadUser);

app.use('/uploads/certificates', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '..', 'uploads'), {
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    },
  }),
);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
// President / Vice President endpoints
app.use('/president', presidentRouter);
app.use('/vice-president', vicePresidentRouter);
// Attendance routes use both /events/:id/... and /users/me/... paths.
// Mount BEFORE /events so attendance gets first match for /events/:id/registrants etc.
app.use('/', attendanceRouter);
app.use('/events', eventsRouter);
app.use('/teams', teamsRouter);
app.use('/gallery', galleryRouter);
app.use('/', galleryRouter); // /photos routes (POST /photos, PATCH /photos/:id, DELETE /photos/:id)
app.use('/sponsors', sponsorsRouter);
app.use('/join-requests', joinRequestsRouter);
app.use('/about', aboutRouter);
app.use('/event-history', eventHistoryRouter);
app.use('/', certificatesRouter);
app.use('/events', leaderboardsRouter);
app.use('/events', announcementsRouter);
app.use('/notifications', notificationsRouter);
app.use('/analytics', analyticsRouter);
app.use('/activity-log', activityLogRouter);
app.use('/', searchRouter);
app.use('/projects', projectsRouter);
app.use('/mentors', mentorsRouter);


// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler. Catches HttpError + everything else. The four-arg signature is
// what tells Express this is an error middleware.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be 15 MiB or smaller'
      : err.message;
    res.status(status).json({ error: message });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
};

app.use(errorHandler);

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
  console.log(`[backend] allowed email domain: ${process.env.ALLOWED_EMAIL_DOMAIN || '@example.edu'}`);
});
