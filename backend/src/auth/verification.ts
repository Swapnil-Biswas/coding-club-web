import crypto from 'node:crypto';
import { Resend } from 'resend';
import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import type { EmailVerificationRow } from '../lib/types.js';

// 15 minutes is enough that you can find the email, not so long that a leaked
// code stays usable. Codes are stored hashed so a DB dump doesn't hand over
// active verification tokens.
const CODE_TTL_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

function verificationSecret(): string {
  const secret = process.env.VERIFICATION_CODE_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error('VERIFICATION_CODE_SECRET is required');
  return secret;
}

function generateCode(): string {
  // 6-digit numeric, zero-padded. crypto.randomInt avoids the modulo bias that
  // Math.random() would give us.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code: string): string {
  return crypto.createHmac('sha256', verificationSecret()).update(code).digest('hex');
}

function codeMatches(storedHash: string, code: string): boolean {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashCode(code), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function buildEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
               style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px;border:1px solid #334155;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:40px 48px 0;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:12px 20px;">
                <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">⟨/⟩ Coding Club</span>
              </div>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:32px 48px 0;text-align:center;">
              <h1 style="margin:0;color:#f1f5f9;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Verify your email</h1>
              <p style="margin:12px 0 0;color:#94a3b8;font-size:15px;line-height:1.6;">
                Use the code below to complete your sign-up.<br/>It expires in <strong style="color:#a5b4fc;">15 minutes</strong>.
              </p>
            </td>
          </tr>
          <!-- OTP box -->
          <tr>
            <td style="padding:36px 48px;">
              <div style="background:#1e293b;border:1px solid #6366f1;border-radius:12px;padding:28px;text-align:center;">
                <span style="font-size:46px;font-weight:800;letter-spacing:14px;color:#a5b4fc;font-variant-numeric:tabular-nums;">
                  ${code}
                </span>
              </div>
            </td>
          </tr>
          <!-- Warning -->
          <tr>
            <td style="padding:0 48px 24px;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                If you didn't create an account, you can safely ignore this email.<br/>
                Never share this code with anyone.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px 40px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Coding Club · BMSIT&M</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface IssuedVerificationCode {
  code: string;
  expiresAt: string;
}

export async function issueVerificationCode(
  userId: number | bigint,
  email: string,
): Promise<IssuedVerificationCode> {
  const code = generateCode();
  const expiresAtMs = Date.now() + CODE_TTL_MINUTES * 60_000;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const result = db.transaction(() => {
    db.prepare(
      `UPDATE email_verifications SET consumed_at = datetime('now')
       WHERE user_id = ? AND consumed_at IS NULL`,
    ).run(userId);
    return db.prepare(
      `INSERT INTO email_verifications (user_id, code_hash, expires_at, expires_at_epoch, failed_attempts)
       VALUES (?, ?, ?, ?, 0)`,
    ).run(userId, hashCode(code), expiresAt, Math.floor(expiresAtMs / 1000));
  })();

  const apiKey = process.env.RESEND_API_KEY;
  const isConfigured = Boolean(apiKey && !apiKey.startsWith('re_your_'));
  const developmentLogging = process.env.NODE_ENV !== 'production' && process.env.LOG_VERIFICATION_CODES === 'true';

  if (!isConfigured) {
    if (developmentLogging) {
      console.warn(`[email-verify] development code for ${email}: ${code} (expires ${expiresAt})`);
      return { code, expiresAt };
    }
    db.prepare(`UPDATE email_verifications SET consumed_at = datetime('now') WHERE id = ?`).run(result.lastInsertRowid);
    throw new HttpError(503, 'Verification email service is unavailable');
  }

  try {
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || '';
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `${code} — your Coding Club verification code`,
      html: buildEmailHtml(code),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    db.prepare(`UPDATE email_verifications SET consumed_at = datetime('now') WHERE id = ?`).run(result.lastInsertRowid);
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email-verify] delivery failed:', message);
    throw new HttpError(503, 'Verification email could not be delivered');
  }

  return { code, expiresAt };
}

export function consumeVerificationCode(userId: number, code: string): true {
  if (!/^\d{6}$/.test(String(code))) throw new HttpError(400, 'Invalid or expired verification code');

  const row = db.prepare<EmailVerificationRow>(
    `SELECT id, user_id, code_hash, expires_at, expires_at_epoch, failed_attempts, consumed_at
     FROM email_verifications
     WHERE user_id = ? AND consumed_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
  ).get(userId);

  if (!row || row.expires_at_epoch <= Math.floor(Date.now() / 1000) || row.failed_attempts >= MAX_FAILED_ATTEMPTS) {
    throw new HttpError(400, 'Invalid or expired verification code');
  }

  if (codeMatches(row.code_hash, code)) {
    const result = db.prepare(
      `UPDATE email_verifications SET consumed_at = datetime('now')
       WHERE id = ? AND consumed_at IS NULL AND failed_attempts < ? AND expires_at_epoch > unixepoch()`,
    ).run(row.id, MAX_FAILED_ATTEMPTS);
    if (result.changes === 1) return true;
    throw new HttpError(400, 'Invalid or expired verification code');
  }

  db.prepare(
    `UPDATE email_verifications
     SET failed_attempts = failed_attempts + 1,
         consumed_at = CASE WHEN failed_attempts + 1 >= ? THEN datetime('now') ELSE consumed_at END
     WHERE id = ? AND consumed_at IS NULL AND failed_attempts < ?`,
  ).run(MAX_FAILED_ATTEMPTS, row.id, MAX_FAILED_ATTEMPTS);
  throw new HttpError(400, 'Invalid or expired verification code');
}
