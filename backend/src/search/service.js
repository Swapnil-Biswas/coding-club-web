import { db } from '../db.js';

function escapeLike(s) {
  return String(s).replace(/[%_\\]/g, '\\$&');
}

export function search(actor, query) {
  const q = String(query || '').trim();
  if (!q || q.length < 2) return { events: [], users: [], teams: [] };

  const like = `%${escapeLike(q)}%`;

  // Public events for everyone; all events for core+
  const eventWhere =
    actor && ['core', 'core_head', 'admin'].includes(actor.role)
      ? `WHERE (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR venue LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')`
      : `WHERE status = 'published' AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR venue LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')`;
  const events = db
    .prepare(
      `SELECT id, title, status, start_datetime, venue, category
       FROM events ${eventWhere}
       ORDER BY start_datetime DESC LIMIT 20`,
    )
    .all(like, like, like, like);

  // Users: only core+ can search other users
  let users = [];
  if (actor && ['core_head', 'admin', 'President', 'core'].includes(actor.role)) {
    users = db
      .prepare(
        `SELECT id, name, email, role, club_title
         FROM users
         WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
         ORDER BY name ASC LIMIT 20`,
      )
      .all(like, like);
  }

  // Teams: public
  const teams = db
    .prepare(
      `SELECT id, name, description
       FROM teams
       WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
       ORDER BY name ASC LIMIT 20`,
    )
    .all(like, like);

  return { events, users, teams };
}
