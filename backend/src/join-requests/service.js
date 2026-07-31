import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageJoinRequests, canViewJoinRequests } from '../lib/permissions.js';

const VALID_STATUSES = ['new', 'contacted', 'closed'];

function publicJoinRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status,
    notes: row.notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Public submission. Does NOT create an account, verify email, promote user,
// or assign any role. Just creates a request row.
export function submitJoinRequest(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const message = String(body.message || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  if (!email) throw new HttpError(400, 'email is required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'email is invalid');
  if (!message) throw new HttpError(400, 'message is required');

  const result = db
    .prepare(
      `INSERT INTO join_requests (name, email, message, status) VALUES (?, ?, ?, 'new')`,
    )
    .run(name, email, message);
  return publicJoinRequest(
    db.prepare(`SELECT * FROM join_requests WHERE id = ?`).get(result.lastInsertRowid),
  );
}

export function listJoinRequests(actor) {
  if (!canViewJoinRequests(actor)) throw new HttpError(403, 'forbidden');
  const rows = db
    .prepare(`SELECT * FROM join_requests ORDER BY created_at DESC`)
    .all();
  return rows.map(publicJoinRequest);
}

export function updateJoinRequest(actor, id, body) {
  if (!canManageJoinRequests(actor)) throw new HttpError(403, 'forbidden');
  const current = db.prepare(`SELECT * FROM join_requests WHERE id = ?`).get(Number(id));
  if (!current) throw new HttpError(404, 'join request not found');
  const sets = [];
  const params = [];
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) throw new HttpError(400, 'invalid status');
    sets.push('status = ?');
    params.push(body.status);
  }
  if (body.notes !== undefined) {
    sets.push('notes = ?');
    params.push(String(body.notes).trim());
  }
  if (sets.length === 0) return publicJoinRequest(current);
  sets.push("updated_at = datetime('now')");
  params.push(Number(id));
  db.prepare(`UPDATE join_requests SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicJoinRequest(
    db.prepare(`SELECT * FROM join_requests WHERE id = ?`).get(Number(id)),
  );
}