import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { ROLES, publicUser, findUserById, changePassword } from '../auth/service.js';

// The role transition matrix. Every PATCH /users/:id/role request is checked
// here — and ONLY here. The matrix is the single source of truth.
//
// Rules:
//   - core       : view-only, cannot promote anyone.
//   - core_head  : can promote member → core only.
//   - admin      : full control — any from/to combination.
//                  Hard guard below prevents self-demotion.
const ROLES_LIST = ['public', 'member', 'core', 'core_head', 'admin'];

const ALLOWED_TRANSITIONS = [
  // core_head: member → core only
  { actor: 'core_head', from: 'member', to: 'core' },
  // admin: every possible (from → to) pair
  ...ROLES_LIST.flatMap((from) =>
    ROLES_LIST
      .filter((to) => to !== from)
      .map((to) => ({ actor: 'admin', from, to })),
  ),
];

export function canTransition(actorRole, fromRole, toRole) {
  return ALLOWED_TRANSITIONS.some(
    (t) => t.actor === actorRole && t.from === fromRole && t.to === toRole,
  );
}

export function listUsers() {
  return db
    .prepare(
      `SELECT id, name, email, role, email_verified, created_at, promoted_by, promoted_at
       FROM users
       ORDER BY created_at DESC`,
    )
    .all()
    .map((u) => ({ ...u, email_verified: Boolean(u.email_verified) }));
}

export function changeUserRole({ actor, targetUserId, newRole }) {
  if (!ROLES.includes(newRole)) {
    throw new HttpError(400, `invalid role: ${newRole}`);
  }
  const target = findUserById(Number(targetUserId));
  if (!target) throw new HttpError(404, 'user not found');

  const fromRole = target.role;

  // Same-role "promote" is a no-op. Don't 403 it — clients may click twice,
  // and the end state is identical. Return the user unchanged.
  if (fromRole === newRole) return publicUser(target);

  if (!canTransition(actor.role, fromRole, newRole)) {
    throw new HttpError(403, `role transition ${actor.role}: ${fromRole} -> ${newRole} not allowed`);
  }

  // Hard guard: even though the matrix doesn't allow it, never let an admin
  // demote themselves. (The matrix already excludes self-admin-creation; this
  // closes the last loophole.)
  if (actor.id === target.id && actor.role === 'admin' && newRole !== 'admin') {
    throw new HttpError(403, 'admin cannot demote themselves');
  }

  db.prepare(
    `UPDATE users SET role = ?, promoted_by = ?, promoted_at = datetime('now') WHERE id = ?`,
  ).run(newRole, actor.id, target.id);

  return publicUser(findUserById(target.id));
}

export function setProfilePhotoPath(userId, filename) {
  db.prepare(`UPDATE users SET profile_photo_path = ? WHERE id = ?`).run(filename, userId);
}

export { publicUser, findUserById, changePassword };
