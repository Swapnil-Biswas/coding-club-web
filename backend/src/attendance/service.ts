import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import {
  canExportEventAttendance,
  canImportEventRegistrants,
  canOperateEventCheckin,
  canUndoEventCheckin,
  canViewEventRegistrants,
  isFaculty,
} from '../lib/permissions.js';
import crypto from 'node:crypto';
import type {
  ActorLike,
  AttendanceRegistrant,
  CheckinResult,
  CsvRow,
  EventRow,
  ExportAttendanceResult,
  ImportRegistrantsResult,
  MyQrToken,
  ParsedCsv,
  RegistrantRow,
} from '../lib/types.js';

function requireEvent(eventId: number): EventRow {
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!event) throw new HttpError(404, 'event not found');
  return event;
}

// --- QR token generation ---------------------------------------------------
function generateQrToken(): string {
  // URL-safe base64, 32 bytes = 43 chars, short enough for QR
  return crypto.randomBytes(32).toString('base64url');
}

// --- CSV parsing -----------------------------------------------------------
export const CSV_MAX_BYTES = 1024 * 1024;
const CSV_MAX_ROWS = 2_000;
const CSV_MAX_COLUMNS = 20;
const CSV_MAX_FIELD_LENGTH = 500;

function parseCsv(text: string): ParsedCsv {
  if (Buffer.byteLength(text, 'utf8') > CSV_MAX_BYTES) {
    throw new HttpError(413, 'CSV must be 1 MiB or smaller');
  }

  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = (): void => {
    if (field.length > CSV_MAX_FIELD_LENGTH) throw new HttpError(400, 'CSV field is too long');
    record.push(field);
    field = '';
    if (record.length > CSV_MAX_COLUMNS) throw new HttpError(400, 'CSV has too many columns');
  };
  const pushRecord = (): void => {
    pushField();
    if (record.some((value) => value.trim() !== '')) records.push(record);
    record = [];
    if (records.length > CSV_MAX_ROWS + 1) throw new HttpError(400, `CSV is limited to ${CSV_MAX_ROWS} data rows`);
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (inQuotes || field.length === 0) {
        inQuotes = !inQuotes;
      } else {
        throw new HttpError(400, 'CSV contains an invalid quote');
      }
    } else if (character === ',' && !inQuotes) {
      pushField();
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      pushRecord();
    } else {
      field += character;
      if (field.length > CSV_MAX_FIELD_LENGTH) throw new HttpError(400, 'CSV field is too long');
    }
  }
  if (inQuotes) throw new HttpError(400, 'CSV contains an unterminated quoted field');
  if (field.length > 0 || record.length > 0) pushRecord();
  if (records.length < 2) return { headers: [], rows: [] };

  const headerRecord = records[0]!;
  const headers = headerRecord.map((header) => header.trim().toLowerCase());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new HttpError(400, 'CSV headers must be non-empty and unique');
  }

  const dataRecords = records.slice(1);
  if (dataRecords.some((values) => values.length !== headerRecord.length)) {
    throw new HttpError(400, 'CSV rows must have the same number of columns as the header');
  }

  const rows = dataRecords.map((values) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

// Map various possible CSV header names to our canonical fields
function normalizeHeaders(row: CsvRow): { name: string; email: string; team: string } {
  const name = row.name || row['full name'] || row['student name'] || row['participant name'] || '';
  const email = row.email || row['email address'] || row['mail id'] || row['student email'] || '';
  const team = row.team || row['team name'] || row.group || row['group name'] || '';
  return { name, email, team };
}

// --- Service methods -------------------------------------------------------

// Import registrants from CSV text. Returns summary counts.
export function importRegistrants(eventId: number, csvText: string, actor: ActorLike): ImportRegistrantsResult {
  const event = requireEvent(eventId);
  if (!canImportEventRegistrants(actor, event)) throw new HttpError(403, 'forbidden');
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
  const getExisting = db.prepare(`SELECT id FROM event_registrants WHERE event_id = ? AND email = ?`);
  const findUser = db.prepare<{ id: number }>(`SELECT id FROM users WHERE email = ? AND email_verified = 1`);

  db.transaction(() => {
    for (const rawRow of rows) {
      const normalized = normalizeHeaders(rawRow);
      const name = normalized.name.trim();
      const email = normalized.email.trim().toLowerCase();
      const team = normalized.team.trim();
      if (!name || name.length > 100 || email.length > 254 || team.length > 100) { errors++; continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors++; continue; }

      if (getExisting.get(eventId, email)) { skipped++; continue; }
      const user = findUser.get(email);
      const result = insertStmt.run(eventId, user?.id ?? null, name, email, team, generateQrToken());
      if (result.changes === 1) created++;
      else skipped++;
    }
  })();

  return { created, skipped, errors, total: rows.length };
}

// Get registrants list for an event (core_head+ or faculty observer)
export function listRegistrants(eventId: number, actor: ActorLike): AttendanceRegistrant[] {
  const event = requireEvent(eventId);
  if (!canViewEventRegistrants(actor, event)) throw new HttpError(403, 'forbidden');

  const includeEmail = !isFaculty(actor);
  return db.prepare<AttendanceRegistrant>(`
    SELECT r.id, r.event_id, r.user_id, r.name,
           ${includeEmail ? 'r.email' : "''"} AS email,
           r.team_name, r.checked_in, r.checked_in_at, r.created_at,
           cb.name as checked_in_by_name
    FROM event_registrants r
    LEFT JOIN users cb ON cb.id = r.checked_in_by
    WHERE r.event_id = ?
    ORDER BY r.created_at ASC
  `).all(eventId);
}

// Check-in by QR token (core+)
export function checkinByQr(eventId: number, qrToken: string, actor: ActorLike): CheckinResult {
  const event = requireEvent(eventId);
  if (!canOperateEventCheckin(actor, event)) throw new HttpError(403, 'forbidden');
  if (!/^[A-Za-z0-9_-]{43}$/.test(qrToken)) throw new HttpError(400, 'invalid QR code');

  const registrant = db.prepare<Pick<RegistrantRow, 'id' | 'checked_in' | 'checked_in_at' | 'checked_in_by'>>(`
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

  const result = db.prepare(`
    UPDATE event_registrants
    SET checked_in = 1, checked_in_at = datetime('now'), checked_in_by = ?
    WHERE id = ? AND event_id = ? AND checked_in = 0
  `).run(actor.id, registrant.id, eventId);
  if (result.changes !== 1) throw new HttpError(409, 'registrant check-in state changed');

  return { success: true, message: 'Checked in successfully', registrantId: registrant.id };
}

// Manual check-in by search (core+)
export function manualCheckin(eventId: number, searchQuery: string, actor: ActorLike): AttendanceRegistrant[] {
  const event = requireEvent(eventId);
  if (!canOperateEventCheckin(actor, event)) throw new HttpError(403, 'forbidden');
  const query = String(searchQuery).trim();
  if (query.length < 2 || query.length > 100) throw new HttpError(400, 'search query must be between 2 and 100 characters');
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;

  return db.prepare<AttendanceRegistrant>(`
    SELECT id, event_id, user_id, name, email, team_name, checked_in, checked_in_at, created_at
    FROM event_registrants
    WHERE event_id = ? AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR team_name LIKE ? ESCAPE '\\')
    ORDER BY name ASC
    LIMIT 25
  `).all(eventId, pattern, pattern, pattern);
}

// Manual check-in specific registrant (core+)
export function manualCheckinRegistrant(eventId: number, registrantId: number, actor: ActorLike): CheckinResult {
  const event = requireEvent(eventId);
  if (!canOperateEventCheckin(actor, event)) throw new HttpError(403, 'forbidden');

  const registrant = db.prepare<Pick<RegistrantRow, 'id' | 'checked_in' | 'checked_in_at' | 'checked_in_by'>>(`
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

  const result = db.prepare(`
    UPDATE event_registrants
    SET checked_in = 1, checked_in_at = datetime('now'), checked_in_by = ?
    WHERE id = ? AND event_id = ? AND checked_in = 0
  `).run(actor.id, registrantId, eventId);
  if (result.changes !== 1) throw new HttpError(409, 'registrant check-in state changed');

  return { success: true, message: 'Checked in successfully', registrantId };
}

// Undo check-in (core_head+ only)
export function undoCheckin(eventId: number, registrantId: number, actor: ActorLike): CheckinResult {
  const event = requireEvent(eventId);
  if (!canUndoEventCheckin(actor, event)) throw new HttpError(403, 'forbidden');

  const registrant = db.prepare<Pick<RegistrantRow, 'id' | 'checked_in' | 'checked_in_at' | 'checked_in_by'>>(`
    SELECT id, checked_in, checked_in_at, checked_in_by
    FROM event_registrants
    WHERE event_id = ? AND id = ?
  `).get(eventId, registrantId);

  if (!registrant) throw new HttpError(404, 'registrant not found');
  if (!registrant.checked_in) throw new HttpError(400, 'registrant not checked in');

  const result = db.prepare(`
    UPDATE event_registrants
    SET checked_in = 0, checked_in_at = NULL, checked_in_by = NULL
    WHERE id = ? AND event_id = ? AND checked_in = 1
  `).run(registrantId, eventId);
  if (result.changes !== 1) throw new HttpError(409, 'registrant check-in state changed');

  return { success: true, message: 'Check-in undone', registrantId };
}

// Export attendance as CSV (core_head+ or faculty observer)
export function exportAttendance(eventId: number, actor: ActorLike): ExportAttendanceResult {
  const event = requireEvent(eventId);
  if (!canExportEventAttendance(actor, event)) throw new HttpError(403, 'forbidden');

  const rows = db.prepare<{ name: string; email: string; team_name: string; status: string; checked_in_at: string | null; checked_in_by: string | null }>(`
    SELECT r.name, ${isFaculty(actor) ? "''" : 'r.email'} AS email, r.team_name,
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

function escapeCsv(val: unknown): string {
  if (val == null) return '';
  const raw = String(val);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Get attended events for current user (profile page)
export function getMyAttendedEvents(userId: number): Array<Pick<EventRow, 'id' | 'title' | 'start_datetime' | 'end_datetime' | 'venue' | 'banner_image_path'> & { checked_in_at: string | null }> {
  return db.prepare<Pick<EventRow, 'id' | 'title' | 'start_datetime' | 'end_datetime' | 'venue' | 'banner_image_path'> & { checked_in_at: string | null }>(`
    SELECT e.id, e.title, e.start_datetime, e.end_datetime, e.venue, e.banner_image_path,
           r.checked_in_at
    FROM event_registrants r
    JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ? AND r.checked_in = 1
    ORDER BY e.start_datetime DESC
  `).all(userId);
}

// Get QR token for current user's registration at an event
export function getMyQrToken(userId: number, eventId: number): MyQrToken | undefined {
  return db.prepare<MyQrToken>(`
    SELECT qr_code_token, checked_in
    FROM event_registrants
    WHERE user_id = ? AND event_id = ?
  `).get(userId, eventId);
}