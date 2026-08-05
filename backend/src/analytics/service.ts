import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canViewAnalytics } from '../lib/permissions.js';
import type {
  ActorLike,
  AnalyticsOverview,
  AnalyticsTotals,
  CertificateType,
  EventAnalyticsStats,
  EventRow,
  EventStatus,
  Role,
} from '../lib/types.js';

type EventStatusCount = { status: EventStatus; count: number };
type UserRoleCount = { role: Role; count: number };
type RecentEvent = Pick<EventRow, 'id' | 'title' | 'status' | 'start_datetime'>;
type CertificateTypeCount = { certificate_type: CertificateType; count: number };

export interface EventAnalytics {
  event: EventRow;
  stats: EventAnalyticsStats;
  certificateTypes: CertificateTypeCount[];
}

export function getAnalyticsOverview(actor: ActorLike | null | undefined): AnalyticsOverview {
  if (!canViewAnalytics(actor)) throw new HttpError(403, 'forbidden');

  const totals = db.prepare<AnalyticsTotals>(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM events) as total_events,
      (SELECT COUNT(*) FROM event_registrants) as total_registrants,
      (SELECT COUNT(*) FROM event_registrants WHERE checked_in = 1) as total_checked_in,
      (SELECT COUNT(*) FROM teams) as total_teams,
      (SELECT COUNT(*) FROM certificates) as total_certificates,
      (SELECT COUNT(*) FROM event_history) as total_history
  `).get() as AnalyticsTotals;

  const eventsByStatus = db.prepare<EventStatusCount>(`
    SELECT status, COUNT(*) AS count FROM events GROUP BY status
  `).all();

  const usersByRole = db.prepare<UserRoleCount>(`
    SELECT role, COUNT(*) AS count FROM users GROUP BY role
  `).all();

  const recentEvents = db.prepare<RecentEvent>(`
    SELECT id, title, status, start_datetime
    FROM events
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  return {
    totals,
    eventsByStatus,
    usersByRole,
    recentEvents,
  };
}

export function getEventAnalytics(
  actor: ActorLike | null | undefined,
  eventId: string | number,
): EventAnalytics {
  if (!canViewAnalytics(actor)) throw new HttpError(403, 'forbidden');
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');

  const stats = db.prepare<EventAnalyticsStats>(`
    SELECT
      (SELECT COUNT(*) FROM event_registrants WHERE event_id = ?) as total_registrants,
      (SELECT COUNT(*) FROM event_registrants WHERE event_id = ? AND checked_in = 1) as checked_in,
      (SELECT COUNT(*) FROM event_registrants WHERE event_id = ? AND user_id IS NOT NULL) as member_registrants,
      (SELECT COUNT(*) FROM certificates WHERE event_id = ?) as certificates_issued,
      (SELECT COUNT(*) FROM announcements WHERE event_id = ?) as announcements_posted,
      (SELECT COUNT(*) FROM leaderboards WHERE event_id = ?) as leaderboard_entries
  `).get(event.id, event.id, event.id, event.id, event.id, event.id) as EventAnalyticsStats;

  const certificateTypes = db.prepare<CertificateTypeCount>(`
    SELECT certificate_type, COUNT(*) AS count
    FROM certificates WHERE event_id = ?
    GROUP BY certificate_type
  `).all(event.id);

  return { event, stats, certificateTypes };
}
