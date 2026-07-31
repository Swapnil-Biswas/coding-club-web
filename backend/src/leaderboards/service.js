import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageLeaderboard, canViewLeaderboard, logActivity } from '../lib/permissions.js';

function publicLeaderboard(row) {
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

export function getLeaderboard(eventId, viewer) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canViewLeaderboard(viewer, event)) throw new HttpError(403, 'forbidden');
  const rows = db
    .prepare(`SELECT * FROM leaderboards WHERE event_id = ? ORDER BY score DESC, rank ASC`)
    .all(Number(eventId));
  return rows.map(publicLeaderboard);
}

export function updateLeaderboard(actor, eventId, body) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageLeaderboard(actor, event)) throw new HttpError(403, 'forbidden');

  const entries = body.entries || [];
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new HttpError(400, 'entries array required');
  }

  const tx = db.transaction(() => {
    for (const entry of entries) {
      const teamName = String(entry.team_name || '').trim();
      const score = Number(entry.score);
      if (!teamName || Number.isNaN(score)) continue;

      const existing = db
        .prepare(`SELECT * FROM leaderboards WHERE event_id = ? AND team_name = ?`)
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
    details: { entries: entries.length },
  });

  return getLeaderboard(eventId, actor);
}

function recalculateRanks(eventId) {
  const rows = db
    .prepare(`SELECT id FROM leaderboards WHERE event_id = ? ORDER BY score DESC`)
    .all(eventId);
  rows.forEach((row, idx) => {
    db.prepare(`UPDATE leaderboards SET rank = ? WHERE id = ?`).run(idx + 1, row.id);
  });
}