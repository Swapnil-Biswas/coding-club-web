// Centralized permission layer for Phase 4.
//
// All API routes MUST call helpers in this file rather than embedding role/
// title checks. The President is NOT a separate role — they're a core_head
// whose club_title === 'President'. Admin can do everything.
//
// Why a central layer?
//   - The spec mixes role (core_head) and title (President) in the same
//     sentences, so checking them ad-hoc in each route is error-prone.
//   - When we add a new capability later, we add ONE function here, not
//     a chain of if/elses scattered across the codebase.
//   - President "see-everything" is a global override; encoding it once
//     means there's no chance of forgetting it in a new route.

import { db } from '../db.js';
import { logActivity } from './activityLog.js';
import { notifyRegistrants } from '../notifications/service.js';

import type {
  ActorLike,
  CertificateRow,
  CertificateTemplateRow,
  EventRow,
  PhotoRow,
  Role,
  TeamRow,
} from './types.js';

// Role rank — for tier checks (at-least-X).
// NOTE: 'faculty' is intentionally absent from ROLE_RANK. It is a parallel
// role, not part of the linear hierarchy. All faculty-specific permission
// checks are done via explicit isFaculty() guards below.
const ROLE_RANK: Partial<Record<Role, number>> = { public: 0, member: 1, core: 2, core_head: 3, admin: 4 };

// Is this actor a faculty observer?
export function isFaculty(actor: ActorLike | null | undefined): boolean {
  return actor?.role === 'faculty';
}

export function roleAtLeast(role: Role | undefined, minRole: Role): boolean {
  return (role ? (ROLE_RANK[role] ?? 0) : 0) >= (ROLE_RANK[minRole] ?? 0);
}

// --- Identity helpers ----------------------------------------------------

export function isAdmin(actor: ActorLike | null | undefined): boolean {
  return actor?.role === 'admin';
}

export function isPresident(actor: ActorLike | null | undefined): boolean {
  return actor?.role === 'core_head' && actor?.club_title === 'President';
}

export function isVicePresident(actor: ActorLike | null | undefined): boolean {
  return actor?.role === 'core_head' && actor?.club_title === 'Vice President';
}

// Admin, President, and Vice President are all "super core heads" for the
// purposes of team / gallery / history / event management.
export function isSuperCoreHead(actor: ActorLike | null | undefined): boolean {
  return isAdmin(actor) || isPresident(actor) || isVicePresident(actor);
}

// True when the actor can do core+ things (e.g. create events, scan QR).
export function isCorePlus(actor: ActorLike | null | undefined): boolean {
  return roleAtLeast(actor?.role, 'core');
}

// True when the actor can do core_head+ things (e.g. publish, import CSV).
export function isCoreHeadPlus(actor: ActorLike | null | undefined): boolean {
  return roleAtLeast(actor?.role, 'core_head') || isSuperCoreHead(actor);
}

// --- Team permissions ----------------------------------------------------

// Get team row (cached lookup, returns the team or null).
function getTeam(teamId: number | string | null | undefined): TeamRow | null {
  if (!teamId) return null;
  return db.prepare<TeamRow>(`SELECT * FROM teams WHERE id = ?`).get(Number(teamId)) ?? null;
}

// Can this actor manage the given team?
//   - admin: always
//   - President: always (global core-head permissions)
//   - core_head (non-President): only teams they own
//   - everyone else: no
export function canManageTeam(actor: ActorLike | null | undefined, teamId: number | string): boolean {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  if (!roleAtLeast(actor.role, 'core_head')) return false;
  if (isPresident(actor)) return true;
  const team = getTeam(teamId);
  if (!team) return false;
  return team.owner_core_head_id === actor.id;
}

// Can this actor see every team (for the President's "All Teams" view)?
export function canManageAllTeams(actor: ActorLike | null | undefined): boolean {
  return isSuperCoreHead(actor);
}

// Can this actor create a new team?
//   Only core_head, President, or admin.
export function canCreateTeam(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  return actor.role === 'core_head';
}

// --- Team member permissions --------------------------------------------

// Same rules as canManageTeam — adding/removing/updating members is a team
// management operation.
export function canManageTeamMembers(actor: ActorLike | null | undefined, teamId: number | string): boolean {
  return canManageTeam(actor, teamId);
}

// --- Gallery permissions -------------------------------------------------

// Can this actor manage ANY photo (no ownership / team check)?
export function canManageAllPhotos(actor: ActorLike | null | undefined): boolean {
  return isSuperCoreHead(actor);
}

// Can this actor manage this specific photo?
//   - admin / President: yes (any photo)
//   - member / core: only their own photos (and only delete; cannot feature/reorder)
//   - core_head (non-President): only photos on an event they organized
//     (per spec: "delete any photo belonging to their own team")
//
// For Phase 4 we treat the "own team" relationship as: uploader == actor,
// OR the photo's event was organized by the actor's core_head team. Since
// core_head teams don't have a strict event→team binding in our schema, the
// practical rule is: the photo was uploaded by a member of a team this
// core_head owns. We resolve this by checking if the uploader is in any
// team owned by this core_head.
export function canManagePhoto(actor: ActorLike | null | undefined, photo: PhotoRow | null | undefined): boolean {
  if (!actor || !photo) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  // Owner can always delete their own photo (per spec).
  if (photo.uploaded_by === actor.id) return true;
  // core_head (non-President): can manage photos uploaded by members of
  // teams they own.
  if (actor.role === 'core_head') {
    const owned = db
      .prepare(
        `SELECT 1 AS x FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE t.owner_core_head_id = ? AND tm.user_id = ?`,
      )
      .get(actor.id, photo.uploaded_by);
    if (owned) return true;
  }
  return false;
}

// Can this actor feature / reorder photos? (Stronger than just delete.)
//   - admin / President: yes
//   - core_head (non-President): yes for photos in their owned teams
//   - member / core: no (only delete their own)
export function canFeatureOrReorder(actor: ActorLike | null | undefined, photo: PhotoRow | null | undefined): boolean {
  if (!actor || !photo) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  if (actor.role === 'core_head') {
    const owned = db
      .prepare(
        `SELECT 1 AS x FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE t.owner_core_head_id = ? AND tm.user_id = ?`,
      )
      .get(actor.id, photo.uploaded_by);
    if (owned) return true;
  }
  return false;
}

// Can this actor upload a photo?
export function canUploadPhoto(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  return roleAtLeast(actor.role, 'member');
}

// --- Event History permissions ------------------------------------------

// Can this actor create / edit the history of this event?
//   - admin: yes (any event)
//   - President: yes (any event)
//   - core_head: only events they organized
//   - everyone else: no
export function canManageEventHistory(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  if (!actor || !event) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  if (actor.role === 'core_head') {
    return event.organizer_id === actor.id;
  }
  return false;
}

// --- About page permissions ---------------------------------------------

export function canEditAboutPage(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  return isAdmin(actor) || isPresident(actor) || actor.role === 'core_head';
}

// --- Sponsor permissions ------------------------------------------------

export function canManageSponsors(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  return actor.role === 'core_head';
}

// --- Join Request permissions -------------------------------------------

export function canViewJoinRequests(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  return actor.role === 'core_head';
}

export function canManageJoinRequests(actor: ActorLike | null | undefined): boolean {
  return canViewJoinRequests(actor);
}

// --- President assignment -----------------------------------------------

// Only Admin can assign/remove President.
export function canAssignPresident(actor: ActorLike | null | undefined): boolean {
  return isAdmin(actor);
}

// --- Phase 5: Event-level management ----------------------------------

// Can this actor manage certificates, leaderboards, announcements for this event?
//   - admin: always
//   - President: always (global core-head permissions)
//   - core_head: only events they organized
//   - everyone else: no
export function canManageEvent(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  if (!actor || !event) return false;
  if (isSuperCoreHead(actor)) return true;
  return actor.role === 'core_head' && event.organizer_id === actor.id;
}

export function canViewEventRegistrants(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return Boolean(event && (isFaculty(actor) || canManageEvent(actor, event)));
}

export function canImportEventRegistrants(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return canManageEvent(actor, event);
}

export function canOperateEventCheckin(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  if (!actor || !event || event.status !== 'published') return false;
  return actor.role === 'core' || canManageEvent(actor, event);
}

export function canUndoEventCheckin(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return canManageEvent(actor, event);
}

export function canExportEventAttendance(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return Boolean(event && (isFaculty(actor) || canManageEvent(actor, event)));
}

// --- Phase 5: Certificate permissions ---------------------------------

export function canUploadTemplate(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  return isAdmin(actor) || isPresident(actor) || actor.role === 'core_head';
}

export function canManageTemplate(actor: ActorLike | null | undefined, template: CertificateTemplateRow | null | undefined): boolean {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  if (actor.role === 'core_head' && template) {
    return template.created_by === actor.id;
  }
  return false;
}

export function canGenerateCertificate(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return canManageEvent(actor, event);
}

export function canEmailCertificate(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return canManageEvent(actor, event);
}

// Download certificates:
//   - admin / President: any
//   - core_head: their events
//   - member: their own
//   - everyone else: 403
export function canDownloadCertificate(actor: ActorLike | null | undefined, certificate: CertificateRow | null | undefined): boolean {
  if (!actor || !certificate) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  // core_head: only certificates for events they organized
  if (actor.role === 'core_head') {
    const event = db.prepare<Pick<EventRow, 'organizer_id'>>(`SELECT organizer_id FROM events WHERE id = ?`).get(certificate.event_id);
    if (event && event.organizer_id === actor.id) return true;
  }
  // members can download their own
  const registrant = db.prepare<{ user_id: number | null }>(`SELECT user_id FROM event_registrants WHERE id = ?`).get(certificate.registrant_id);
  if (registrant && registrant.user_id === actor.id) return true;
  return false;
}

// --- Phase 5: Announcement & Leaderboard permissions ------------------

export function canPostAnnouncement(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return canManageEvent(actor, event);
}

export function canViewAnnouncements(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  if (!event) return false;
  // Anyone can view announcements for a published or completed event
  if (event.status === 'published' || event.status === 'completed') return true;
  // Otherwise need to be logged in and have access
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  if (isFaculty(actor)) return true; // observer — can view all announcements
  if (actor.role === 'core_head') return event.organizer_id === actor.id;
  if (actor.role === 'core' || actor.role === 'member') return false;
  return false;
}

export function canManageLeaderboard(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  return canManageEvent(actor, event);
}

export function canViewLeaderboard(actor: ActorLike | null | undefined, event: EventRow | null | undefined): boolean {
  if (!event) return false;
  if (event.status === 'published' || event.status === 'completed') return true;
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  if (isPresident(actor)) return true;
  if (isFaculty(actor)) return true; // observer — can view leaderboards
  if (actor.role === 'core_head') return event.organizer_id === actor.id;
  return false;
}

// --- Phase 5: Analytics & Activity Log permissions --------------------

export function canViewAnalytics(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  // Faculty are observers — they can view analytics dashboards (read-only).
  return isAdmin(actor) || isPresident(actor) || actor.role === 'core_head' || isFaculty(actor);
}

export function canViewActivityLog(actor: ActorLike | null | undefined): boolean {
  if (!actor) return false;
  return isAdmin(actor) || isPresident(actor);
}

export { logActivity, notifyRegistrants };
