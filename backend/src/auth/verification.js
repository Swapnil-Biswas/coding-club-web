import crypto from 'node:crypto';
import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';

// 15 minutes is enough that you can find the email, not so long that a leaked
// code stays usable. Codes are stored hashed so a DB dump doesn't hand over
// active verification tokens.
const CODE_TTL_MINUTES = 15;

function generateCode() {
  // 6-digit numeric, zero-padded. crypto.randomInt avoids the modulo bias that
  // Math.random() would give us.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function issueVerificationCode(userId, email) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  db.prepare(
    `INSERT INTO email_verifications (user_id, code_hash, expires_at)
     VALUES (?, ?, ?)`,
  ).run(userId, hashCode(code), expiresAt);

  // In dev we just print the code to the backend console. Production would call
  // an email provider here; we don't ship SMTP wiring in Phase 1.
  console.log(`\n[email-verify] user=${userId} email=${email} code=${code} expires=${expiresAt}\n`);

  return { code, expiresAt };
}

export function consumeVerificationCode(userId, code) {
  const row = db
    .prepare(
      `SELECT id, code_hash, expires_at, consumed_at
       FROM email_verifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 5`,
    )
    .get(userId);

  // We need to walk through recent codes — the latest issued may not be the
  // one the user typed. Take the first unused, unexpired, hash-matching one.
  const rows = db
    .prepare(
      `SELECT id, code_hash, expires_at, consumed_at
       FROM email_verifications
       WHERE user_id = ? AND consumed_at IS NULL
       ORDER BY id DESC
       LIMIT 5`,
    )
    .all(userId);

  const now = new Date();
  for (const r of rows) {
    if (r.consumed_at) continue;
    if (new Date(r.expires_at) < now) continue;
    if (r.code_hash !== hashCode(code)) continue;
    db.prepare(`UPDATE email_verifications SET consumed_at = datetime('now') WHERE id = ?`).run(r.id);
    return true;
  }

  // If the user typed a code that didn't match any active row, give a generic
  // error — don't tell them whether the code was wrong vs expired vs already used.
  throw new HttpError(400, 'Invalid or expired verification code');
}
