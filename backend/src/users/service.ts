import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { enqueueManagedImageDeletion } from '../lib/imageUpload.js';
import { ROLES, publicUser, findUserById, changePassword } from '../auth/service.js';
import type { AdminUser, DirectoryUser, PublicUser, Role, SessionUser, UserRow } from '../lib/types.js';

// The role transition matrix. Every PATCH /users/:id/role request is checked
// here — and ONLY here. The matrix is the single source of truth.
//
// Rules:
//   - core       : view-only, cannot promote anyone.
//   - core_head  : can promote member → core only.
//   - admin      : full control — any from/to combination including faculty.
//   - faculty    : parallel role — assigned/removed only by admin.
//                  Hard guard below prevents self-demotion.
//
// NOTE: 'faculty' is intentionally OMITTED from ROLES_LIST so that numeric
// rank comparisons (roleAtLeast, EVENT_MANAGERS, etc.) can never accidentally
// include it. Faculty permissions are defined separately via isFacultyBlocked().
const ROLES_LIST: readonly Exclude<Role, 'faculty'>[] = ['public', 'member', 'core', 'core_head', 'admin'];

interface RoleTransition {
  actor: Role;
  from: Role;
  to: Role;
}

const ALLOWED_TRANSITIONS: readonly RoleTransition[] = [
  // core_head: member → core only
  { actor: 'core_head', from: 'member', to: 'core' },
  // admin: every possible (from → to) pair within the linear hierarchy
  ...ROLES_LIST.flatMap((from) =>
    ROLES_LIST
      .filter((to) => to !== from)
      .map((to) => ({ actor: 'admin' as Role, from, to })),
  ),
  // admin: assign/remove faculty (parallel role — not in the linear list)
  ...ROLES_LIST.map((from) => ({ actor: 'admin' as Role, from, to: 'faculty' as Role })),
  ...ROLES_LIST.map((to) => ({ actor: 'admin' as Role, from: 'faculty' as Role, to })),
];

// Central faculty write-block guard. Import and call this at the top of any
// service function that mutates state. Faculty is an observer role only.
export function isFacultyBlocked(role: Role): boolean {
  return role === 'faculty';
}

export function canTransition(actorRole: Role, fromRole: Role, toRole: Role): boolean {
  return ALLOWED_TRANSITIONS.some(
    (t) => t.actor === actorRole && t.from === fromRole && t.to === toRole,
  );
}

export function listUsers(includeManagementFields: true): AdminUser[];
export function listUsers(includeManagementFields?: false): DirectoryUser[];
export function listUsers(includeManagementFields = false): AdminUser[] | DirectoryUser[] {
  if (!includeManagementFields) {
    return db.prepare<DirectoryUser>(
      `SELECT id, name, role, created_at FROM users ORDER BY created_at DESC`,
    ).all();
  }

  return db
    .prepare<Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'email_verified' | 'created_at' | 'promoted_by' | 'promoted_at'>>(
      `SELECT id, name, email, role, email_verified, created_at, promoted_by, promoted_at
       FROM users
       ORDER BY created_at DESC`,
    )
    .all()
    .map((u) => ({ ...u, email_verified: Boolean(u.email_verified) }));
}

export interface ChangeUserRoleInput {
  actor: SessionUser;
  targetUserId: number | string;
  newRole: Role;
}

export function changeUserRole({ actor, targetUserId, newRole }: ChangeUserRoleInput): PublicUser | null {
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

export function setProfilePhotoPath(userId: number, filename: string): void {
  db.prepare(`UPDATE users SET profile_photo_path = ? WHERE id = ?`).run(filename, userId);
}

export { publicUser, findUserById, changePassword };
