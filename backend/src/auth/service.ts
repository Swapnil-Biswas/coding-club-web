import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { getOne, runQuery } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { publicImageReference } from '../lib/imageUpload.js';
import type { PublicProfile, PublicUser, Role, SessionUser, UserRow } from '../lib/types.js';
import { issueVerificationCode, consumeVerificationCode } from './verification.js';

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const MAX_PASSWORD_BYTES = 72;
const DUMMY_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LQ4NCOYIYr0hVlC7GgO3H3Z1i9Q8z1Z4lCw6K';

function validatePassword(password: string, field = 'password'): void {
  if (password.length < 8) throw new HttpError(400, `${field} must be at least 8 characters`);
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new HttpError(400, `${field} must be at most 72 UTF-8 bytes`);
  }
}

export const ROLES: readonly Role[] = ['public', 'member', 'core', 'core_head', 'admin', 'faculty'];

export function emailDomainIsAllowed(email: string): boolean {
  const e = String(email || '').toLowerCase().trim();
  const domains = (process.env.ALLOWED_EMAIL_DOMAIN || '@example.edu')
    .split(',')
    .map((d) => d.trim().toLowerCase());
  return domains.some((d) => e.endsWith(d));
}

function configuredDomains(): string {
  return process.env.ALLOWED_EMAIL_DOMAIN || '@example.edu';
}

function findUserByEmail(email: string): UserRow | undefined {
  return getOne<UserRow>(`SELECT * FROM users WHERE email = ?`, [String(email).toLowerCase().trim()]);
}

export function findUserById(id: number | string): UserRow | undefined {
  return getOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [id]);
}

export function publicUser(user: UserRow | SessionUser | null | undefined): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    email_verified: Boolean(user.email_verified),
    profile_photo_url: publicImageReference(user.profile_photo_path),
    club_title: user.club_title || null,
    created_at: user.created_at,
  };
}

export function publicProfile(user: UserRow | SessionUser | null | undefined): PublicProfile | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    profile_photo_url: publicImageReference(user.profile_photo_path),
    club_title: user.club_title || null,
  };
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface SignupResult {
  id: number | bigint;
  email: string;
}

export async function signup({ name, email, password }: SignupInput): Promise<SignupResult> {
  if (!name || !email || !password) {
    throw new HttpError(400, 'name, email, and password are required');
  }
  validatePassword(String(password));
  if (!emailDomainIsAllowed(email)) {
    throw new HttpError(400, `email domain not allowed (must end with ${configuredDomains()})`);
  }
  const existing = findUserByEmail(email);
  if (existing) {
    throw new HttpError(409, 'email already registered');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const normalizedEmail = String(email).toLowerCase().trim();
  const defaultRole: Role = normalizedEmail.endsWith('@bmsit.in') ? 'member' : 'public';

  const result = runQuery(
    `INSERT INTO users (name, email, password_hash, role, email_verified)
     VALUES (?, ?, ?, ?, 0)`,
    [name, normalizedEmail, passwordHash, defaultRole],
  );

  const userId = result.lastInsertRowid;
  try {
    await issueVerificationCode(userId, normalizedEmail);
  } catch (error) {
    runQuery(
      `DELETE FROM users
       WHERE id = ? AND email_verified = 0`,
      [userId],
    );
    throw error;
  }

  return { id: userId, email: normalizedEmail };
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export async function verifyEmail({ email, code }: VerifyEmailInput): Promise<PublicUser | null> {
  const user = findUserByEmail(email);
  if (!user) throw new HttpError(400, 'Invalid or expired verification code');
  consumeVerificationCode(user.id, code);
  runQuery(`UPDATE users SET email_verified = 1 WHERE id = ?`, [user.id]);
  return publicUser(findUserById(user.id));
}

export async function resendVerificationCode(email: unknown): Promise<{ ok: true }> {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);
  if (user && !user.email_verified) {
    await issueVerificationCode(user.id, user.email);
  }
  return { ok: true };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  sessionId: string;
  expiresAt: string;
  user: PublicUser | null;
}

export async function login({ email, password }: LoginInput): Promise<LoginResult> {
  const user = findUserByEmail(email);
  const ok = await bcrypt.compare(String(password ?? ''), user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid credentials');

  if (!user.email_verified) {
    throw new HttpError(403, 'Email not verified — check your inbox for the verification code');
  }

  return createSession(user);
}

export function createSession(user: UserRow): LoginResult {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAtMs = Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();
  runQuery(`INSERT INTO sessions (id, user_id, expires_at, expires_at_epoch) VALUES (?, ?, ?, ?)`, [
    id,
    user.id,
    expiresAt,
    Math.floor(expiresAtMs / 1000),
  ]);
  return { sessionId: id, expiresAt, user: publicUser(findUserById(user.id)) };
}

export function destroySession(sessionId: string | undefined): void {
  if (!sessionId) return;
  runQuery(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
}

export function userFromSessionId(sessionId: string | undefined): UserRow | null {
  if (!sessionId) return null;
  const row = getOne<UserRow>(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at_epoch > unixepoch()`,
    [sessionId],
  );
  return row || null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(userId: number, { currentPassword, newPassword }: ChangePasswordInput): Promise<void> {
  validatePassword(String(newPassword ?? ''), 'New password');
  const user = findUserById(userId);
  if (!user) throw new HttpError(404, 'user not found');
  const ok = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  runQuery(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, userId]);
  runQuery(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}
