import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { ROLES, publicUser, findUserById, changePassword } from '../auth/service.js';

// The role transition matrix. Every PATCH /users/:id/role request is checked
// here — and ONLY here. The matrix is the single source of truth.
//
// Phase 1 (3 transitions):
//   - core can promote public -> member
//   - admin can promote member -> core
//   - admin can demote core -> member
//   - everything else is 403
//
// Phase 2 additions (the new 'core_head' tier is admin-managed, mirroring how
// 'core' is admin-managed):
//   - admin can promote core -> core_head
//   - admin can demote core_head -> core
//
// Notes on choices not in the spec:
//   - admin can never be assigned via this route. Admins are seeded only.
//   - admin cannot self-demote (would lock the system out if it was the only admin).
//   - No public->admin, no member->admin, no public->core, no core->admin, no
//     member->core_head. Each of these is 403.
//
// The matrix is a list of (actorRole, fromRole, toRole) tuples. Any transition
// not in the list is rejected. Easier to audit than a chain of if/elses.
const ALLOWED_TRANSITIONS = [
  { actor: 'core', from: 'public', to: 'member' },
  { actor: 'admin', from: 'member', to: 'core' },
  { actor: 'admin', from: 'core', to: 'member' },
  { actor: 'admin', from: 'core', to: 'core_head' },
  { actor: 'admin', from: 'core_head', to: 'core' },
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
