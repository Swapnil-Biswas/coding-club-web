import 'dotenv/config';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'node:crypto';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';

import { authRouter } from './auth/routes.js';
import { usersRouter } from './users/routes.js';
import { presidentRouter } from './users/president.js';
import { vicePresidentRouter } from './users/vice-president.js';
import { secretaryRouter } from './users/secretary.js';
import { treasurerRouter } from './users/treasurer.js';
import { eventsRouter } from './events/routes.js';
import { attendanceRouter } from './attendance/routes.js';
import { teamsRouter } from './teams/routes.js';
import { galleryRouter } from './gallery/routes.js';
import { sponsorsRouter } from './sponsors/routes.js';
import { joinRequestsRouter } from './join-requests/routes.js';
import { aboutRouter } from './about/routes.js';
import { eventHistoryRouter } from './event-history/routes.js';
import { leaderboardsRouter } from './leaderboards/routes.js';
import { announcementsRouter } from './announcements/routes.js';
import { notificationsRouter } from './notifications/routes.js';
import { analyticsRouter } from './analytics/routes.js';
import { activityLogRouter } from './activity-log/routes.js';
import { searchRouter } from './search/routes.js';
import { projectsRouter } from './projects/routes.js';
import { mentorsRouter } from './mentors/routes.js';
import { arcadeRouter } from './arcade/routes.js';
import { buildersRouter } from './builders/routes.js';
import { recruitmentRouter } from './recruitment/routes.js';
import { processSheetsOutbox } from './recruitment/sheets-worker.js';
import { HttpError } from './lib/errors.js';
import {
  processManagedImageDeletionQueue,
  removeStaleTemporaryUploads,
} from './lib/imageUpload.js';
import { loadUser, SESSION_COOKIE } from './auth/middleware.js';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  strictTransportSecurity: isProduction
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
}));

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

// TRUST_PROXY_CIDRS: comma-separated CIDRs/IPs of reverse proxies in front of
// this server (e.g. nginx, Cloudflare). Set to 'none' to explicitly run without
// a proxy. Unset in production logs a warning but does NOT crash — many simple
// VPS setups run Node directly.
const rawProxyCidrs = (process.env.TRUST_PROXY_CIDRS ?? '').trim();
const trustedProxyCidrs = rawProxyCidrs === 'none'
  ? []
  : rawProxyCidrs.split(',').map((v) => v.trim()).filter(Boolean);
if (isProduction && rawProxyCidrs === '') {
  console.warn(
    '[backend] WARNING: TRUST_PROXY_CIDRS is not set. ' +
    'If you are running behind a reverse proxy, set it to your proxy CIDRs. ' +
    'If running directly (no proxy), set TRUST_PROXY_CIDRS=none to silence this.'
  );
}
// In dev the Next.js proxy runs on loopback and adds X-Forwarded-For.
// Trust loopback in dev; in production use the explicit list (or false = no proxy).
const trustProxy = trustedProxyCidrs.length > 0
  ? trustedProxyCidrs
  : (isProduction ? false : 'loopback');
app.set('trust proxy', trustProxy);

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

const redisUrl = process.env.RATE_LIMIT_REDIS_URL?.trim() ?? '';
if (isProduction && !redisUrl) {
  console.warn(
    '[backend] WARNING: RATE_LIMIT_REDIS_URL is not set. ' +
    'Rate limit counters will be in-memory and reset on every restart. ' +
    'Set this to a Redis URL for persistent rate limiting across restarts/instances.'
  );
}
const redisClient = redisUrl ? createClient({ url: redisUrl }) : null;
if (redisClient) {
  redisClient.on('error', (error) => console.error('[rate-limit] Redis error', error));
  await redisClient.connect();
}
const rateLimitStore = (prefix: string): RedisStore | undefined => redisClient
  ? new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: `coding-club:${prefix}:`,
    })
  : undefined;

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
  store: rateLimitStore('early'),
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
  store: rateLimitStore('auth-ip'),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts, please try again in 15 minutes.' },
});

const authAccountLimiter = rateLimit({
  store: rateLimitStore('auth-account-ip'),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'test' ||
    typeof req.body?.email !== 'string' ||
    req.body.email.trim() === '',
  keyGenerator: (req) => {
    const account = crypto
      .createHash('sha256')
      .update(String(req.body?.email).trim().toLowerCase())
      .digest('hex');
    return `${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown')}:${account}`;
  },
  message: { error: 'Too many attempts, please try again in 15 minutes.' },
});

// Looser limiter for the rest of the API (DoS mitigation).
const apiLimiter = rateLimit({
  store: rateLimitStore('api'),
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
// Rate-limit only POST /join-requests (public submission).
// Admin GET and PATCH must NOT consume this budget.
const joinRequestSubmitLimiter = rateLimit({
  store: rateLimitStore('join-requests-post'),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1, // 1 submission per IP per day
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || req.method !== 'POST',
  message: { error: 'You have already submitted a join request. Please wait before trying again.' },
});
app.use('/join-requests', joinRequestSubmitLimiter);

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
// President / Vice President / Secretary / Treasurer endpoints
app.use('/president', presidentRouter);
app.use('/vice-president', vicePresidentRouter);
app.use('/secretary', secretaryRouter);
app.use('/treasurer', treasurerRouter);
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
if (!isProduction || process.env.ENABLE_CERTIFICATES === 'true') {
  const { certificatesRouter } = await import('./certificates/routes.js');
  app.use('/', certificatesRouter);
}
app.use('/events', leaderboardsRouter);
app.use('/events', announcementsRouter);
app.use('/notifications', notificationsRouter);
app.use('/analytics', analyticsRouter);
app.use('/activity-log', activityLogRouter);
app.use('/', searchRouter);
app.use('/projects', projectsRouter);
app.use('/mentors', mentorsRouter);
app.use('/arcade', arcadeRouter);

// BMSIT Builders: per-user submission rate limit (5 POST per hour).
const buildersSubmitLimiter = rateLimit({
  store: rateLimitStore('builders-post'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || req.method !== 'POST',
  keyGenerator: (req) => String(req.user?.id ?? ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown')),
  message: { error: 'Too many repo submissions. Please wait before submitting again.' },
});
app.use('/builders', buildersSubmitLimiter);
app.use('/builders', buildersRouter);

// Recruitment: strict limit for public application submissions
// (2 per IP per 24 h — allows genuine retry without enabling abuse)
const recruitmentSubmitLimiter = rateLimit({
  store: rateLimitStore('recruitment-post'),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || req.method !== 'POST' || !req.path.includes('/apply'),
  message: { error: 'Too many application submissions from this IP. Please try again later.' },
});
app.use('/recruitment', recruitmentSubmitLimiter);
app.use('/recruitment', recruitmentRouter);


// Script Kiddie Honeypot Route (Roast automated scanners & curl /admin attempts)
app.all(['/admin', '/admin/*'], (_req, res) => {
  res.status(418).json({
    status: 418,
    error: 'ACCESS_DENIED_SCRIPT_KIDDIE',
    message: "Did you really think the admin panel was unauthenticated on /admin in 2026? 💀",
    roast: "Bro typed /admin and expected root access. Go solve Two Sum first.",
    threat_level: "DEFCON_TODDLER",
    actual_admin_panel: "Nice try. We don't expose routes to strangers. Figure it out yourself.",
    join_club: "Visit /join to learn actual software engineering and cybersecurity.",
  });
});

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

let cleanupRunning = false;
const runManagedFileCleanup = async (): Promise<void> => {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    await processManagedImageDeletionQueue();
  } catch (error) {
    console.error('[uploads] deletion queue processing failed', error);
  } finally {
    cleanupRunning = false;
  }
};

await removeStaleTemporaryUploads().catch((error) => {
  console.error('[uploads] stale temporary-file cleanup failed', error);
});
await runManagedFileCleanup();
const cleanupTimer = setInterval(() => void runManagedFileCleanup(), 60_000);
cleanupTimer.unref();

// Google Sheets sync worker: runs every 2 minutes, processes the SQL outbox.
// Never blocks the HTTP process — errors are logged and retried on next tick.
let sheetsWorkerRunning = false;
const sheetsWorkerTimer = setInterval(() => {
  if (sheetsWorkerRunning) return;
  sheetsWorkerRunning = true;
  processSheetsOutbox()
    .catch((e) => console.error('[sheets-worker] unhandled error', e))
    .finally(() => { sheetsWorkerRunning = false; });
}, 2 * 60_000);
sheetsWorkerTimer.unref();


const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
  console.log(`[backend] allowed email domain: ${process.env.ALLOWED_EMAIL_DOMAIN || '@example.edu'}`);
});
