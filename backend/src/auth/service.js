import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { issueVerificationCode, consumeVerificationCode } from './verification.js';

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;

export const ROLES = ['public', 'member', 'core', 'core_head', 'admin'];

function allowedDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN || '@example.edu').toLowerCase();
}

export function emailDomainIsAllowed(email) {
  const e = String(email || '').toLowerCase().trim();
  const d = allowedDomain();
  return e.endsWith(d);
}

function findUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(String(email).toLowerCase().trim());
}

export function findUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    email_verified: Boolean(user.email_verified),
    profile_photo_url: user.profile_photo_path ? `/uploads/${user.profile_photo_path}` : null,
    club_title: user.club_title || null,
    created_at: user.created_at,
  };
}

export async function signup({ name, email, password }) {
  if (!name || !email || !password) {
    throw new HttpError(400, 'name, email, and password are required');
  }
  if (String(password).length < 8) {
    throw new HttpError(400, 'password must be at least 8 characters');
  }
  if (!emailDomainIsAllowed(email)) {
    throw new HttpError(400, `email domain not allowed (must end with ${allowedDomain()})`);
  }
  const existing = findUserByEmail(email);
  if (existing) {
    throw new HttpError(409, 'email already registered');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, email_verified)
       VALUES (?, ?, ?, 'public', 0)`,
    )
    .run(name, String(email).toLowerCase().trim(), passwordHash);

  const userId = result.lastInsertRowid;
  issueVerificationCode(userId, email);

  return { id: userId, email };
}

export async function verifyEmail({ email, code }) {
  const user = findUserByEmail(email);
  if (!user) throw new HttpError(400, 'Invalid or expired verification code');
  consumeVerificationCode(user.id, code);
  db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).run(user.id);
  return publicUser(findUserById(user.id));
}

export async function login({ email, password }) {
  const user = findUserByEmail(email);
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid credentials');

  if (!user.email_verified) {
    throw new HttpError(403, 'Email not verified — check your inbox for the verification code');
  }

  return createSession(user);
}

export function createSession(user) {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(
    id,
    user.id,
    expiresAt,
  );
  return { sessionId: id, expiresAt, user: publicUser(findUserById(user.id)) };
}

export function destroySession(sessionId) {
  if (!sessionId) return;
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

export function userFromSessionId(sessionId) {
  if (!sessionId) return null;
  const row = db
    .prepare(
      `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .get(sessionId);
  return row || null;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  if (!newPassword || newPassword.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters');
  }
  const user = findUserById(userId);
  if (!user) throw new HttpError(404, 'user not found');
  const ok = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, userId);
}
