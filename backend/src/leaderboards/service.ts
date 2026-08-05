import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageLeaderboard, canViewLeaderboard, logActivity } from '../lib/permissions.js';
import { positiveId, stringValue } from '../lib/validation.js';
import type {
  ActorLike,
  EventRow,
  LeaderboardRow,
  PublicLeaderboardEntry,
  SessionUser,
} from '../lib/types.js';

type EventId = string | number | undefined;

interface LeaderboardUpdateEntry {
  team_name?: unknown;
  score?: unknown;
}

interface LeaderboardUpdateBody {
  entries?: LeaderboardUpdateEntry[];
}

function publicLeaderboard(row: LeaderboardRow | null | undefined): PublicLeaderboardEntry | null {
  if (!row) return null;
  return {
    id: row.id,
    event_id: row.event_id,
    team_name: row.team_name,
    score: row.score,
    rank: row.rank,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  };
}

export function getLeaderboard(eventId: EventId, viewer: ActorLike | null | undefined): Array<PublicLeaderboardEntry | null> {
  const id = positiveId(eventId, 'event id');
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(id);
  if (!event) throw new HttpError(404, 'event not found');
  if (!canViewLeaderboard(viewer, event)) throw new HttpError(403, 'forbidden');
  const rows = db
    .prepare<LeaderboardRow>(`SELECT * FROM leaderboards WHERE event_id = ? ORDER BY score DESC, rank ASC`)
    .all(id);
  return rows.map(publicLeaderboard);
}

export function updateLeaderboard(
  actor: SessionUser,
  eventId: EventId,
  body: LeaderboardUpdateBody,
): Array<PublicLeaderboardEntry | null> {
  const id = positiveId(eventId, 'event id');
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(id);
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageLeaderboard(actor, event)) throw new HttpError(403, 'forbidden');

  const entries = body.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new HttpError(400, 'entries array required');
  }
  if (entries.length > 100) {
    throw new HttpError(400, 'entries cannot contain more than 100 items');
  }

  const seen = new Set<string>();
  const validatedEntries = entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new HttpError(400, 'each leaderboard entry must be an object');
    }
    const teamName = stringValue(entry.team_name, {
      field: 'team_name',
      min: 1,
      max: 100,
    });
    const teamKey = teamName.toLocaleLowerCase('en-US');
    if (seen.has(teamKey)) {
      throw new HttpError(400, 'duplicate team_name');
    }
    seen.add(teamKey);
    if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) {
      throw new HttpError(400, 'score must be a finite number');
    }
    return { teamName, score: entry.score };
  });

  const tx = db.transaction(() => {
    for (const { teamName, score } of validatedEntries) {

      const existing = db
        .prepare<LeaderboardRow>(`SELECT * FROM leaderboards WHERE event_id = ? AND team_name = ?`)
        .get(event.id, teamName);

      if (existing) {
        db.prepare(
          `UPDATE leaderboards SET score = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(score, actor.id, existing.id);
      } else {
        db.prepare(
          `INSERT INTO leaderboards (event_id, team_name, score, rank, updated_by) VALUES (?, ?, ?, 0, ?)`,
        ).run(event.id, teamName, score, actor.id);
      }
    }
    // Recalculate ranks
    recalculateRanks(event.id);
  });

  tx();

  logActivity({
    userId: actor.id,
    action: 'Updated Leaderboard',
    entity: 'leaderboard',
    entityId: event.id,
    details: { entries: validatedEntries.length },
  });

  return getLeaderboard(eventId, actor);
}

function recalculateRanks(eventId: number): void {
  const rows = db
    .prepare<Pick<LeaderboardRow, 'id'>>(`SELECT id FROM leaderboards WHERE event_id = ? ORDER BY score DESC`)
    .all(eventId);
  rows.forEach((row, idx) => {
    db.prepare(`UPDATE leaderboards SET rank = ? WHERE id = ?`).run(idx + 1, row.id);
  });
}