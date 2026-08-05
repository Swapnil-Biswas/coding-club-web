import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageJoinRequests, canViewJoinRequests } from '../lib/permissions.js';
import { positiveId, stringValue } from '../lib/validation.js';
import type {
  ActorLike,
  JoinRequestRow,
  JoinRequestStatus,
  PublicJoinRequest,
} from '../lib/types.js';

const VALID_STATUSES: readonly JoinRequestStatus[] = ['new', 'contacted', 'closed'];

function publicJoinRequest(row: JoinRequestRow | null | undefined): PublicJoinRequest | null {
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

export interface SubmitJoinRequestPayload {
  name?: string;
  email?: string;
  message?: string;
}

// Public submission. Does NOT create an account, verify email, promote user,
// or assign any role. Just creates a request row.
export function submitJoinRequest(body: SubmitJoinRequestPayload): PublicJoinRequest | null {
  const name = stringValue(body.name, { field: 'name', min: 1, max: 100 });
  const email = stringValue(body.email, { field: 'email', min: 3, max: 254 }).toLowerCase();
  const message = stringValue(body.message, { field: 'message', min: 1, max: 2_000 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'email is invalid');

  const result = db
    .prepare(
      `INSERT INTO join_requests (name, email, message, status) VALUES (?, ?, ?, 'new')`,
    )
    .run(name, email, message);
  return publicJoinRequest(
    db.prepare<JoinRequestRow>(`SELECT * FROM join_requests WHERE id = ?`).get(result.lastInsertRowid),
  );
}

export function listJoinRequests(actor: ActorLike): PublicJoinRequest[] {
  if (!canViewJoinRequests(actor)) throw new HttpError(403, 'forbidden');
  const rows = db
    .prepare<JoinRequestRow>(`SELECT * FROM join_requests ORDER BY created_at DESC`)
    .all();
  return rows.map((row) => publicJoinRequest(row)!);
}

export interface UpdateJoinRequestPayload {
  status?: JoinRequestStatus;
  notes?: string;
}

export function updateJoinRequest(
  actor: ActorLike,
  id: number | string,
  body: UpdateJoinRequestPayload,
): PublicJoinRequest | null {
  if (!canManageJoinRequests(actor)) throw new HttpError(403, 'forbidden');
  const requestId = positiveId(id, 'join request id');
  const current = db.prepare<JoinRequestRow>(`SELECT * FROM join_requests WHERE id = ?`).get(requestId);
  if (!current) throw new HttpError(404, 'join request not found');
  const sets: string[] = [];
  const params: Array<string | number> = [];
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) throw new HttpError(400, 'invalid status');
    sets.push('status = ?');
    params.push(body.status);
  }
  if (body.notes !== undefined) {
    sets.push('notes = ?');
    params.push(stringValue(body.notes, { field: 'notes', max: 2_000, required: false }));
  }
  if (sets.length === 0) return publicJoinRequest(current);
  sets.push("updated_at = datetime('now')");
  params.push(requestId);
  db.prepare(`UPDATE join_requests SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicJoinRequest(
    db.prepare<JoinRequestRow>(`SELECT * FROM join_requests WHERE id = ?`).get(Number(id)),
  );
}
