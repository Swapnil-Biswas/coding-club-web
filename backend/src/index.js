import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authRouter } from './auth/routes.js';
import { usersRouter } from './users/routes.js';
import { presidentRouter } from './users/president.js';
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
import { HttpError } from './lib/errors.js';
import { loadUser } from './auth/middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// In dev the Vite server runs on a different port, so CORS is needed. In prod we
// serve the built frontend from the same origin and CORS is irrelevant.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin (no Origin header) and Vite dev server are both fine.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser(process.env.COOKIE_SIGN_KEY || process.env.SESSION_SECRET || 'dev'));
app.use(loadUser);

// Static for profile photos. Files are saved under backend/uploads/ with names
// <userId>.<ext> so we never expose a user-controlled path here.
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
// President endpoints
app.use('/president', presidentRouter);
// Attendance routes use both /events/:id/... and /users/me/... paths.
// Mount BEFORE /events so attendance gets first match for /events/:id/registrants etc.
app.use('/', attendanceRouter);
app.use('/events', eventsRouter);
app.use('/teams', teamsRouter);
app.use('/gallery', galleryRouter);
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


// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler. Catches HttpError + everything else. The four-arg signature is
// what tells Express this is an error middleware.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
  console.log(`[backend] allowed email domain: ${process.env.ALLOWED_EMAIL_DOMAIN || '@example.edu'}`);
});
