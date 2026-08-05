import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { publicImageReference } from '../lib/imageUpload.js';
import { canManageTeam } from '../lib/permissions.js';
import type {
  ActivityLogRow,
  ActorLike,
  EventRow,
  PublicTeamMember,
  TeamMemberRow,
  TeamRow,
} from '../lib/types.js';

type DashboardMemberRow = Omit<TeamMemberRow, 'team_id'>;
type DashboardEvent = Pick<EventRow, 'id' | 'title' | 'status' | 'start_datetime' | 'venue'>;

interface TeamDashboard {
  team: TeamRow;
  memberCount: number;
  members: Array<DashboardMemberRow & Pick<PublicTeamMember, 'profile_photo_url'>>;
  events: DashboardEvent[];
  activity: ActivityLogRow[];
}

export function getTeamDashboard(actor: ActorLike, teamId: number | string): TeamDashboard {
  const team = db.prepare<TeamRow>(`SELECT * FROM teams WHERE id = ?`).get(Number(teamId));
  if (!team) throw new HttpError(404, 'team not found');
  // Must be team owner, President, or admin to see dashboard
  if (!canManageTeam(actor, teamId)) throw new HttpError(403, 'forbidden');

  const members = db
    .prepare<DashboardMemberRow>(
      `SELECT tm.id, tm.user_id, tm.designation, tm.display_order, tm.joined_at,
              u.name, u.email, u.role, u.club_title, u.profile_photo_path
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ?
       ORDER BY tm.display_order ASC, u.name ASC`,
    )
    .all(team.id);

  // Events organized by any team member
  const eventIds = members.map((m) => m.user_id);
  let events: DashboardEvent[] = [];
  if (eventIds.length) {
    const placeholders = eventIds.map(() => '?').join(',');
    events = db
      .prepare<DashboardEvent>(
        `SELECT id, title, status, start_datetime, venue
         FROM events
         WHERE organizer_id IN (${placeholders})
         ORDER BY start_datetime DESC LIMIT 50`,
      )
      .all(...eventIds);
  }

  // Recent activity for the team (from activity log filtered to team-related)
  const activity = db
    .prepare<ActivityLogRow>(
      `SELECT al.*, u.name as user_name, u.role as user_role
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE (al.entity = 'team' AND al.entity_id = ?) OR
             (al.entity = 'event' AND al.entity_id IN (${eventIds.length ? eventIds.map(() => '?').join(',') : 'NULL'}))
       ORDER BY al.timestamp DESC LIMIT 50`,
    )
    .all(team.id, ...(eventIds.length ? eventIds : [null]));

  return {
    team,
    memberCount: members.length,
    members: members.map((m) => ({
      ...m,
      profile_photo_url: publicImageReference(m.profile_photo_path),
    })),
    events,
    activity,
  };
}
