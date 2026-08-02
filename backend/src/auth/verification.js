import crypto from 'node:crypto';
import { Resend } from 'resend';
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

function buildEmailHtml(code) {
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

export async function issueVerificationCode(userId, email) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  db.prepare(
    `INSERT INTO email_verifications (user_id, code_hash, expires_at)
     VALUES (?, ?, ?)`,
  ).run(userId, hashCode(code), expiresAt);

  const apiKey = process.env.RESEND_API_KEY;
  const isConfigured = apiKey && !apiKey.startsWith('re_your_');

  if (!isConfigured) {
    // Fallback for local dev when the key is not set / still a placeholder.
    console.warn(
      `\n[email-verify] RESEND_API_KEY not configured — printing code to console.\n` +
      `  user=${userId}  email=${email}  code=${code}  expires=${expiresAt}\n`,
    );
    return { code, expiresAt };
  }

  try {
    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Coding Club <noreply@bmsit.in>';

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `${code} — your Coding Club verification code`,
      html: buildEmailHtml(code),
    });

    if (error) {
      // Resend returned a structured error — log it but don't crash signup.
      // The code is already stored; the user can request a resend.
      console.error('[email-verify] Resend API error:', error);
    } else {
      console.log(`[email-verify] Verification email sent → ${email}`);
    }
  } catch (err) {
    // Network failure, bad credentials, etc. — never crash the signup request.
    console.error('[email-verify] Failed to send verification email:', err?.message ?? err);
  }

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
