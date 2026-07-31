import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import crypto from 'node:crypto';
import { publicUser } from '../auth/service.js';

// Role ranks for permission checks
const ROLE_RANK = { public: 0, member: 1, core: 2, core_head: 3, admin: 4 };
function can(role, ...allowed) { return allowed.includes(role); }
function isCorePlus(role) { return ROLE_RANK[role] >= 2; }
function isCoreHeadPlus(role) { return ROLE_RANK[role] >= 3; }

// --- QR token generation ---------------------------------------------------
function generateQrToken() {
  // URL-safe base64, 32 bytes = 43 chars, short enough for QR
  return crypto.randomBytes(32).toString('base64url');
}

// --- CSV parsing -----------------------------------------------------------
// Minimal RFC-4180 CSV parser (handles quoted fields, commas in quotes)
// Expects header row; case-insensitive header matching.
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse header
  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Map various possible CSV header names to our canonical fields
function normalizeHeaders(row) {
  const name = row.name || row['full name'] || row['student name'] || row['participant name'] || '';
  const email = row.email || row['email address'] || row['mail id'] || row['student email'] || '';
  const team = row.team || row['team name'] || row.group || row['group name'] || '';
  return { name, email, team };
}

// --- Service methods -------------------------------------------------------

// Import registrants from CSV text. Returns summary counts.
export function importRegistrants(eventId, csvText, actor) {
  if (!isCoreHeadPlus(actor.role)) throw new HttpError(403, 'forbidden');

  const event = db.prepare(`SELECT id, status FROM events WHERE id = ?`).get(eventId);
  if (!event) throw new HttpError(404, 'event not found');
  if (event.status !== 'published' && event.status !== 'completed') {
    throw new HttpError(400, 'registrants can only be imported for published or completed events');
  }

  const { rows } = parseCsv(csvText);
  if (rows.length === 0) throw new HttpError(400, 'CSV has no data rows');

  let created = 0, skipped = 0, errors = 0;

  const insertStmt = db.prepare(`
    INSERT INTO event_registrants (event_id, user_id, name, email, team_name, qr_code_token)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id, email) DO NOTHING
  `);
  const getExisting = db.prepare(`SELECT id, qr_code_token FROM event_registrants WHERE event_id = ? AND email = ?`);
  const findUser = db.prepare(`SELECT id FROM users WHERE email = ? AND email_verified = 1`);

  for (const rawRow of rows) {
    const { name, email, team } = normalizeHeaders(rawRow);
    if (!name || !email) { errors++; continue; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors++; continue; }

    // Check if already exists (via UNIQUE constraint)
    const existing = getExisting.get(eventId, email);
    if (existing) { skipped++; continue; }

    // Auto-link to user account if email matches a verified user
    const user = findUser.get(email);

    try {
      insertStmt.run(eventId, user?.id ?? null, name, email, team, generateQrToken());
      created++;
    } catch (e) {
      errors++;
    }
  }

  return { created, skipped, errors, total: rows.length };
}

// Get registrants list for an event (core_head+ only)
export function listRegistrants(eventId, actor) {
  if (!isCoreHeadPlus(actor.role)) throw new HttpError(403, 'forbidden');
  const event = db.prepare(`SELECT id FROM events WHERE id = ?`).get(eventId);
  if (!event) throw new HttpError(404, 'event not found');

  return db.prepare(`
    SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role,
           cb.name as checked_in_by_name
    FROM event_registrants r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN users cb ON cb.id = r.checked_in_by
    WHERE r.event_id = ?
    ORDER BY r.created_at ASC
  `).all(eventId);
}

// Check-in by QR token (core+)
export function checkinByQr(eventId, qrToken, actor) {
  if (!isCorePlus(actor.role)) throw new HttpError(403, 'forbidden');

  const registrant = db.prepare(`
    SELECT id, checked_in, checked_in_at, checked_in_by
    FROM event_registrants
    WHERE event_id = ? AND qr_code_token = ?
  `).get(eventId, qrToken);

  if (!registrant) throw new HttpError(404, 'invalid QR code');

  if (registrant.checked_in) {
    const by = registrant.checked_in_by
      ? db.prepare(`SELECT name FROM users WHERE id = ?`).get(registrant.checked_in_by)?.name ?? 'unknown'
      : 'unknown';
    return {
      alreadyCheckedIn: true,
      message: `Already checked in at ${registrant.checked_in_at} by ${by}`,
      registrantId: registrant.id
    };
  }

  db.prepare(`
    UPDATE event_registrants
    SET checked_in = 1, checked_in_at = datetime('now'), checked_in_by = ?
    WHERE id = ?
  `).run(actor.id, registrant.id);

  return { success: true, message: 'Checked in successfully', registrantId: registrant.id };
}

// Manual check-in by search (core+)
export function manualCheckin(eventId, searchQuery, actor) {
  if (!isCorePlus(actor.role)) throw new HttpError(403, 'forbidden');

  const rows = db.prepare(`
    SELECT id, name, email, team_name, checked_in, checked_in_at
    FROM event_registrants
    WHERE event_id = ? AND (name LIKE ? OR email LIKE ? OR team_name LIKE ?)
    ORDER BY name ASC
  `).all(eventId, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);

  return rows;
}

// Manual check-in specific registrant (core+)
export function manualCheckinRegistrant(eventId, registrantId, actor) {
  if (!isCorePlus(actor.role)) throw new HttpError(403, 'forbidden');

  const registrant = db.prepare(`
    SELECT id, checked_in, checked_in_at, checked_in_by
    FROM event_registrants
    WHERE event_id = ? AND id = ?
  `).get(eventId, registrantId);

  if (!registrant) throw new HttpError(404, 'registrant not found');

  if (registrant.checked_in) {
    const by = registrant.checked_in_by
      ? db.prepare(`SELECT name FROM users WHERE id = ?`).get(registrant.checked_in_by)?.name ?? 'unknown'
      : 'unknown';
    return {
      alreadyCheckedIn: true,
      message: `Already checked in at ${registrant.checked_in_at} by ${by}`,
      registrantId: registrant.id
    };
  }

  db.prepare(`
    UPDATE event_registrants
    SET checked_in = 1, checked_in_at = datetime('now'), checked_in_by = ?
    WHERE id = ?
  `).run(actor.id, registrantId);

  return { success: true, message: 'Checked in successfully', registrantId };
}

// Undo check-in (core_head+ only)
export function undoCheckin(eventId, registrantId, actor) {
  if (!isCoreHeadPlus(actor.role)) throw new HttpError(403, 'forbidden');

  const registrant = db.prepare(`
    SELECT id, checked_in, checked_in_at, checked_in_by
    FROM event_registrants
    WHERE event_id = ? AND id = ?
  `).get(eventId, registrantId);

  if (!registrant) throw new HttpError(404, 'registrant not found');
  if (!registrant.checked_in) throw new HttpError(400, 'registrant not checked in');

  db.prepare(`
    UPDATE event_registrants
    SET checked_in = 0, checked_in_at = NULL, checked_in_by = NULL
    WHERE id = ?
  `).run(registrantId);

  return { success: true, message: 'Check-in undone', registrantId };
}

// Export attendance as CSV (core_head+)
export function exportAttendance(eventId, actor) {
  if (!isCoreHeadPlus(actor.role)) throw new HttpError(403, 'forbidden');

  const event = db.prepare(`SELECT id, title, start_datetime, venue FROM events WHERE id = ?`).get(eventId);
  if (!event) throw new HttpError(404, 'event not found');

  const rows = db.prepare(`
    SELECT r.name, r.email, r.team_name,
           CASE WHEN r.checked_in = 1 THEN 'Checked In' ELSE 'Absent' END as status,
           r.checked_in_at,
           cb.name as checked_in_by
    FROM event_registrants r
    LEFT JOIN users cb ON cb.id = r.checked_in_by
    WHERE r.event_id = ?
    ORDER BY r.name ASC
  `).all(eventId);

  // Build CSV
  const headers = ['Name', 'Email', 'Team', 'Status', 'Checked In At', 'Checked In By'];
  const csvRows = rows.map(r => [
    r.name, r.email, r.team_name, r.status, r.checked_in_at ?? '', r.checked_in_by ?? ''
  ]);

  const csv = [headers.join(','), ...csvRows.map(r => r.map(escapeCsv).join(','))].join('\n');
  return { csv, filename: `attendance-${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${event.id}.csv` };
}

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Get attended events for current user (profile page)
export function getMyAttendedEvents(userId) {
  return db.prepare(`
    SELECT e.id, e.title, e.start_datetime, e.end_datetime, e.venue, e.banner_image_path,
           r.checked_in_at
    FROM event_registrants r
    JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ? AND r.checked_in = 1
    ORDER BY e.start_datetime DESC
  `).all(userId);
}

// Get QR token for current user's registration at an event
export function getMyQrToken(userId, eventId) {
  return db.prepare(`
    SELECT qr_code_token, checked_in
    FROM event_registrants
    WHERE user_id = ? AND event_id = ?
  `).get(userId, eventId);
}