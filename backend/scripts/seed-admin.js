import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db } from '../src/db.js';

// Seed (or update) the admin account. Admin accounts cannot be created via the
// public signup flow, by spec. Run via: `npm run seed:admin`.
//
// Env vars:
//   SEED_ADMIN_EMAIL      (default: admin@example.edu)
//   SEED_ADMIN_PASSWORD   (default: admin12345 — dev only!)
//   SEED_ADMIN_NAME       (default: Admin)
//
// The admin's email is auto-verified. The role is set to 'admin' regardless of
// what it was before. promoted_by / promoted_at are left null because admins
// are seeded, not promoted.

const email = String(process.env.SEED_ADMIN_EMAIL || 'admin@example.edu').toLowerCase().trim();
const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
const name = process.env.SEED_ADMIN_NAME || 'Admin';

if (String(password).length < 8) {
  console.error('SEED_ADMIN_PASSWORD must be at least 8 characters');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);

const existing = db.prepare(`SELECT id, role FROM users WHERE email = ?`).get(email);

if (existing) {
  db.prepare(
    `UPDATE users SET role = 'admin', email_verified = 1, password_hash = ?, name = ? WHERE id = ?`,
  ).run(passwordHash, name, existing.id);
  console.log(`[seed] updated existing user ${email} (id=${existing.id}) -> admin`);
} else {
  const r = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'admin', 1)`,
    )
    .run(name, email, passwordHash);
  console.log(`[seed] created admin ${email} (id=${r.lastInsertRowid})`);
}
