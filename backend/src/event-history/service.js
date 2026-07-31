import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageEventHistory } from '../lib/permissions.js';

function publicEventHistory(row) {
  if (!row) return null;
  return {
    event_id: row.event_id,
    gist: row.gist,
    winners: row.winners,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Reuse the same visibility logic as events
function eventVisible(viewer, event) {
  if (!event) return false;
  if (viewer && viewer.role === 'admin') return true;
  if (viewer && (viewer.role === 'core' || viewer.role === 'core_head')) return true;
  if (viewer && viewer.role === 'member') {
    return event.status === 'published';
  }
  // public / logged out
  return event.status === 'published' && event.visibility === 'public';
}

export function getEventHistory(eventId) {
  return db.prepare(`SELECT * FROM event_history WHERE event_id = ?`).get(Number(eventId));
}

export function getPublicEventHistory(eventId, viewer) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!eventVisible(viewer, event)) throw new HttpError(404, 'event not found');
  const row = getEventHistory(eventId);
  return row ? publicEventHistory(row) : null;
}

export function createOrUpdateEventHistory(actor, eventId, body) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (event.status !== 'completed') throw new HttpError(400, 'history only allowed for completed events');
  if (!canManageEventHistory(actor, event)) throw new HttpError(403, 'forbidden');

  const gist = String(body.gist || '').trim();
  const winners = String(body.winners || '').trim();

  const existing = getEventHistory(eventId);
  if (existing) {
    const sets = [];
    const params = [];
    if (gist !== undefined) {
      sets.push('gist = ?');
      params.push(gist);
    }
    if (winners !== undefined) {
      sets.push('winners = ?');
      params.push(winners);
    }
    if (sets.length === 0) return publicEventHistory(existing);
    sets.push("updated_at = datetime('now')");
    params.push(Number(eventId));
    db.prepare(`UPDATE event_history SET ${sets.join(', ')} WHERE event_id = ?`).run(...params);
  } else {
    db.prepare(
      `INSERT INTO event_history (event_id, gist, winners) VALUES (?, ?, ?)`
    ).run(Number(eventId), gist, winners);
  }
  return publicEventHistory(getEventHistory(eventId));
}