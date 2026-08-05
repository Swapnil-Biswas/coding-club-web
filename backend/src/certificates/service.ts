import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { validateImageReference } from '../lib/imageUpload.js';
import { positiveId } from '../lib/validation.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import {
  canManageEvent,
  canManageTemplate,
  canUploadTemplate,
} from '../lib/permissions.js';
import { logActivity } from '../lib/activityLog.js';
import type {
  ActorLike,
  CertificateRow,
  CertificateTemplateRow,
  CertificateType,
  EventRow,
  RegistrantRow,
} from '../lib/types.js';

export interface TemplatePayload {
  name?: unknown;
  preview_image?: unknown;
  template_file?: unknown;
}

export interface GenerateCertificatePayload {
  eventId: number | string;
  registrantId: number | string;
  certificateType: CertificateType;
  templateId?: number | string;
}

export interface BulkGeneratePayload {
  eventId: number | string;
  certificateType: CertificateType;
  templateId?: number | string;
  mode?: 'all' | 'checked_in' | 'winners' | 'volunteers';
}

interface CertificateRegistrantRow extends RegistrantRow {
  event_id: number;
  event_title: string;
  organizer_id: number;
  event_status: EventRow['status'];
  start_datetime: string;
}

interface CertificateResult {
  certificate: CertificateRow;
  duplicate: boolean;
}

interface BulkError {
  registrant_id?: number;
  certificate_id?: number;
  error: string;
}

interface BulkGenerateResult {
  created: number;
  skipped: number;
  failed: number;
  errors: BulkError[];
}

interface BulkEmailResult {
  pending: number;
  sent: number;
  failed: number;
  errors: BulkError[];
}

interface VerificationResult {
  id: number;
  verification_id: string;
  certificate_type: CertificateType;
  recipient_name: string;
  team_name: string;
  event_id: number;
  event_title: string;
  event_date: string;
  venue: string;
  generated_at: string;
  generated_by_name: string;
  pdf_url: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certificatesDir = path.resolve(__dirname, '..', '..', 'uploads', 'certificates');
const templatesDir = path.resolve(__dirname, '..', '..', 'uploads', 'templates');
fs.mkdirSync(certificatesDir, { recursive: true });
fs.mkdirSync(templatesDir, { recursive: true });

export const CERTIFICATE_TYPES = ['participation', 'winner', 'volunteer', 'speaker', 'organizer', 'special_recognition'];

// --- Templates ----------------------------------------------------------

export function listTemplates(): CertificateTemplateRow[] {
  return db
    .prepare<CertificateTemplateRow>(
      `SELECT t.*, u.name as creator_name
       FROM certificate_templates t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY t.created_at DESC`,
    )
    .all();
}

export function getTemplateById(id: number | string | bigint): CertificateTemplateRow | undefined {
  return db.prepare<CertificateTemplateRow>(`SELECT * FROM certificate_templates WHERE id = ?`).get(Number(id));
}

export function createTemplate(actor: ActorLike, body: TemplatePayload): CertificateTemplateRow | undefined {
  if (!canUploadTemplate(actor)) throw new HttpError(403, 'forbidden');
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  const templateFile = body.template_file ? String(body.template_file).trim() : null;
  const previewImage = body.preview_image
    ? validateImageReference(body.preview_image, 'preview_image')
    : null;
  if (!templateFile) throw new HttpError(400, 'template_file is required');
  const result = db
    .prepare(
      `INSERT INTO certificate_templates (name, preview_image, template_file, created_by)
       VALUES (?, ?, ?, ?)`,
    )
    .run(name, previewImage, templateFile, actor.id);
  logActivity({
    userId: actor.id,
    action: 'Created Template',
    entity: 'certificate_template',
    entityId: Number(result.lastInsertRowid),
    details: { name },
  });
  return getTemplateById(result.lastInsertRowid);
}

export function updateTemplate(
  actor: ActorLike,
  id: number | string,
  body: TemplatePayload,
): CertificateTemplateRow | undefined {
  const template = getTemplateById(id);
  if (!template) throw new HttpError(404, 'template not found');
  if (!canManageTemplate(actor, template)) throw new HttpError(403, 'forbidden');
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) {
    sets.push('name = ?');
    params.push(String(body.name).trim());
  }
  if (body.preview_image !== undefined) {
    sets.push('preview_image = ?');
    params.push(body.preview_image
      ? validateImageReference(body.preview_image, 'preview_image')
      : null);
  }
  if (body.template_file !== undefined) {
    sets.push('template_file = ?');
    params.push(String(body.template_file).trim());
  }
  if (sets.length === 0) return template;
  params.push(Number(id));
  db.prepare(`UPDATE certificate_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  logActivity({
    userId: actor.id,
    action: 'Updated Template',
    entity: 'certificate_template',
    entityId: Number(id),
  });
  return getTemplateById(id);
}

// --- Certificate Generation --------------------------------------------

// Generate a single certificate.
// Spec rules:
//   - registrant.checked_in must be true
//   - event.status must be 'completed'
//   - UNIQUE(registrant_id, certificate_type) prevents duplicates
export async function generateCertificate(
  actor: ActorLike,
  { eventId, registrantId, certificateType, templateId }: GenerateCertificatePayload,
): Promise<CertificateResult> {
  if (!CERTIFICATE_TYPES.includes(certificateType)) {
    throw new HttpError(400, 'invalid certificate_type');
  }
  const registrant = db
    .prepare<CertificateRegistrantRow>(
      `SELECT r.*, e.id as event_id, e.title as event_title, e.organizer_id, e.status as event_status, e.start_datetime
       FROM event_registrants r
       JOIN events e ON e.id = r.event_id
       WHERE r.id = ?`,
    )
    .get(Number(registrantId));
  if (!registrant || registrant.event_id !== Number(eventId)) {
    throw new HttpError(404, 'registrant not found');
  }
  if (!registrant.checked_in) {
    throw new HttpError(400, 'registrant has not checked in');
  }
  if (registrant.event_status !== 'completed') {
    throw new HttpError(400, 'event is not completed');
  }
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(registrant.event_id);
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');

  // Check if certificate already exists
  const existing = db
    .prepare<CertificateRow>(`SELECT * FROM certificates WHERE registrant_id = ? AND certificate_type = ?`)
    .get(Number(registrantId), certificateType);
  if (existing) {
    return { certificate: existing, duplicate: true };
  }

  const verificationId = uuidv4();
  const template = templateId ? (getTemplateById(templateId) ?? null) : null;
  const result = db
    .prepare(
      `INSERT INTO certificates (registrant_id, event_id, verification_id, certificate_type, template_id, generated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      Number(registrantId),
      registrant.event_id,
      verificationId,
      certificateType,
      template?.id ?? null,
      actor.id,
    );
  const certRow = db.prepare<CertificateRow>(`SELECT * FROM certificates WHERE id = ?`).get(result.lastInsertRowid)!;
  let pdfUrl: string;
  try {
    pdfUrl = await generateCertificatePdf(certRow, registrant, event, template);
    db.prepare(`UPDATE certificates SET pdf_url = ? WHERE id = ?`).run(pdfUrl, certRow.id);
  } catch (error) {
    db.prepare(`DELETE FROM certificates WHERE id = ?`).run(certRow.id);
    throw error;
  }
  logActivity({
    userId: actor.id,
    action: 'Generated Certificate',
    entity: 'certificate',
    entityId: certRow.id,
    details: { verification_id: verificationId, type: certificateType },
  });
  if (registrant.user_id) {
    createNotification({
      userId: registrant.user_id,
      type: 'Certificate Generated',
      message: `Your ${certificateType} certificate for ${event.title} is ready!`,
      link: `/account`,
    });
  }
  return {
    certificate: db.prepare<CertificateRow>(`SELECT * FROM certificates WHERE id = ?`).get(certRow.id)!,
    duplicate: false,
  };
}

export async function bulkGenerateCertificates(
  actor: ActorLike,
  { eventId, certificateType, templateId, mode = 'checked_in' }: BulkGeneratePayload,
): Promise<BulkGenerateResult> {
  if (!CERTIFICATE_TYPES.includes(certificateType)) {
    throw new HttpError(400, 'invalid certificate_type');
  }
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  if (event.status !== 'completed') throw new HttpError(400, 'event is not completed');

  let registrants;
  if (mode === 'all' || mode === 'checked_in') {
    registrants = db
      .prepare<RegistrantRow>(`SELECT * FROM event_registrants WHERE event_id = ? AND checked_in = 1`)
      .all(event.id);
  } else if (mode === 'winners') {
    registrants = db
      .prepare<RegistrantRow>(`SELECT * FROM event_registrants WHERE event_id = ? AND checked_in = 1`)
      .all(event.id);
  } else if (mode === 'volunteers') {
    registrants = db
      .prepare<RegistrantRow>(
        `SELECT * FROM event_registrants WHERE event_id = ? AND checked_in = 1 AND LOWER(team_name) LIKE '%volunteer%'`,
      )
      .all(event.id);
  } else {
    throw new HttpError(400, 'invalid mode');
  }

  if (registrants.length > 100) {
    throw new HttpError(400, 'bulk generation is limited to 100 certificates per request');
  }

  const results: BulkGenerateResult = { created: 0, skipped: 0, failed: 0, errors: [] };
  for (const registrant of registrants) {
    try {
      const { duplicate } = await generateCertificate(actor, {
        eventId: event.id,
        registrantId: registrant.id,
        certificateType,
        templateId,
      });
      if (duplicate) results.skipped++;
      else results.created++;
    } catch (err) {
      results.failed++;
      results.errors.push({ registrant_id: registrant.id, error: errorMessage(err) });
    }
  }
  return results;
}

async function generateCertificatePdf(
  certificate: CertificateRow,
  registrant: RegistrantRow,
  event: EventRow,
  _template: CertificateTemplateRow | null,
): Promise<string> {
  const filename = `${certificate.verification_id}.pdf`;
  const filePath = path.join(certificatesDir, filename);
  const temporaryPath = `${filePath}.${uuidv4()}.tmp`;
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const writeStream = fs.createWriteStream(temporaryPath, { flags: 'wx' });
  doc.pipe(writeStream);

  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(4).stroke('#1a1a1a');
  doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(1).stroke('#666');

  const typeTitle = certificate.certificate_type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  doc.fontSize(36).fillColor('#1a1a1a').text(`Certificate of ${typeTitle}`, { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(18).fillColor('#333').text('This is to certify that', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(40).fillColor('#2563eb').text(registrant.name, { align: 'center' });
  doc.moveDown(0.5);
  const verb = certificate.certificate_type === 'participation' ? 'participated in' : 'contributed as a';
  doc.fontSize(18).fillColor('#333').text(`has successfully ${verb} ${certificate.certificate_type === 'participation' ? '' : certificate.certificate_type}:`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(28).fillColor('#1a1a1a').text(event.title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor('#666').text('Date: ' + new Date(event.start_datetime).toLocaleDateString(), { align: 'center' });
  if (registrant.team_name) {
    doc.fontSize(14).fillColor('#666').text('Team: ' + registrant.team_name, { align: 'center' });
  }

  doc.moveDown(2);
  doc.fontSize(10).fillColor('#666').text('Verification ID: ' + certificate.verification_id, { align: 'center' });
  doc.fontSize(8).fillColor('#999').text('Verify at: /verify/' + certificate.verification_id, { align: 'center' });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      writeStream.destroy();
      reject(error);
    };
    doc.once('error', fail);
    writeStream.once('error', fail);
    writeStream.once('finish', () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    doc.end();
  }).catch((error: unknown) => {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  });

  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
  return `/certificates/${certificate.id}/download`;
}

// --- Verification ------------------------------------------------------

export function verifyCertificate(verificationId: string): VerificationResult | null {
  const cert = db
    .prepare<Required<Pick<CertificateRow,
      | 'id'
      | 'verification_id'
      | 'certificate_type'
      | 'event_id'
      | 'generated_at'
      | 'pdf_url'
      | 'recipient_name'
      | 'recipient_email'
      | 'team_name'
      | 'event_title'
      | 'event_date'
      | 'venue'
      | 'generated_by_name'
    >>>(
      `SELECT c.*, r.name as recipient_name, r.email as recipient_email, r.team_name,
              e.title as event_title, e.start_datetime as event_date, e.venue,
              u.name as generated_by_name
       FROM certificates c
       JOIN event_registrants r ON r.id = c.registrant_id
       JOIN events e ON e.id = c.event_id
       LEFT JOIN users u ON u.id = c.generated_by
       WHERE c.verification_id = ?`,
    )
    .get(String(verificationId));
  if (!cert) return null;
  return {
    id: cert.id,
    verification_id: cert.verification_id,
    certificate_type: cert.certificate_type,
    recipient_name: cert.recipient_name,
    team_name: cert.team_name,
    event_id: cert.event_id,
    event_title: cert.event_title,
    event_date: cert.event_date,
    venue: cert.venue,
    generated_at: cert.generated_at,
    generated_by_name: cert.generated_by_name,
    pdf_url: null,
  };
}

export function getCertificateById(id: number | string | bigint): CertificateRow | undefined {
  return db.prepare<CertificateRow>(`SELECT * FROM certificates WHERE id = ?`).get(positiveId(id, 'certificate_id'));
}

function withDownloadUrl(certificate: CertificateRow): CertificateRow {
  return {
    ...certificate,
    pdf_url: certificate.pdf_url ? `/certificates/${certificate.id}/download` : null,
  };
}

export function getCertificateDownload(
  id: number | string,
  actor: ActorLike,
): { filePath: string; filename: string } {
  const certificate = getCertificateById(id);
  if (!certificate?.pdf_url) throw new HttpError(404, 'certificate not found');
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(certificate.event_id);
  const registrant = db
    .prepare<Pick<RegistrantRow, 'user_id' | 'name'>>(`SELECT user_id, name FROM event_registrants WHERE id = ?`)
    .get(certificate.registrant_id);
  if (!event || !registrant) throw new HttpError(404, 'certificate not found');
  if (registrant.user_id !== actor.id && !canManageEvent(actor, event)) {
    throw new HttpError(403, 'forbidden');
  }

  const filePath = path.join(certificatesDir, `${certificate.verification_id}.pdf`);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'certificate file not found');
  const safeName = registrant.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'certificate';
  return { filePath, filename: `${safeName}-certificate.pdf` };
}

export function listCertificatesForEvent(eventId: number | string, actor: ActorLike): CertificateRow[] {
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  return db
    .prepare<CertificateRow>(
      `SELECT c.*, r.name as recipient_name, r.email as recipient_email
       FROM certificates c
       JOIN event_registrants r ON r.id = c.registrant_id
       WHERE c.event_id = ?
       ORDER BY c.generated_at DESC`,
    )
    .all(Number(eventId))
    .map(withDownloadUrl);
}

export function listMyCertificates(actor: ActorLike | null): CertificateRow[] {
  if (!actor) throw new HttpError(401, 'authentication required');
  return db
    .prepare<CertificateRow>(
      `SELECT c.*, r.name as recipient_name, e.title as event_title, e.start_datetime
       FROM certificates c
       JOIN event_registrants r ON r.id = c.registrant_id
       JOIN events e ON e.id = c.event_id
       WHERE r.user_id = ?
       ORDER BY c.generated_at DESC`,
    )
    .all(actor.id)
    .map(withDownloadUrl);
}

// --- Email Delivery ----------------------------------------------------

export async function emailCertificate(
  actor: ActorLike,
  eventId: number | string,
  certificateId: number | string,
): Promise<{ ok: boolean; status: 'sent' | 'failed'; error?: string }> {
  const cert = getCertificateById(certificateId);
  if (!cert || cert.event_id !== Number(eventId)) throw new HttpError(404, 'certificate not found');
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(cert.event_id);
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  const registrant = db.prepare<RegistrantRow>(`SELECT * FROM event_registrants WHERE id = ?`).get(cert.registrant_id)!;
  try {
    await sendCertificateEmail(cert, registrant, event);
    db
      .prepare(`UPDATE certificates SET emailed_at = datetime('now'), email_status = 'sent' WHERE id = ?`)
      .run(certificateId);
    if (registrant.user_id) {
      createNotification({
        userId: registrant.user_id,
        type: 'Certificate Emailed',
        message: `Your certificate for ${event.title} has been emailed.`,
        link: `/account`,
      });
    }
    return { ok: true, status: 'sent' };
  } catch (err) {
    db.prepare(`UPDATE certificates SET email_status = 'failed' WHERE id = ?`).run(certificateId);
    return { ok: false, status: 'failed', error: errorMessage(err) };
  }
}

export async function bulkEmailCertificates(actor: ActorLike, eventId: number | string): Promise<BulkEmailResult> {
  const event = db.prepare<EventRow>(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  const certs = db
    .prepare<CertificateRow>(`SELECT * FROM certificates WHERE event_id = ? AND email_status != 'sent' LIMIT 101`)
    .all(Number(eventId));
  if (certs.length > 100) {
    throw new HttpError(400, 'bulk email is limited to 100 certificates per request');
  }
  const results: BulkEmailResult = { pending: 0, sent: 0, failed: 0, errors: [] };
  for (const cert of certs) {
    if (cert.email_status === 'sent') continue;
    try {
      const registrant = db.prepare<RegistrantRow>(`SELECT * FROM event_registrants WHERE id = ?`).get(cert.registrant_id)!;
      await sendCertificateEmail(cert, registrant, event);
      db
        .prepare(`UPDATE certificates SET emailed_at = datetime('now'), email_status = 'sent' WHERE id = ?`)
        .run(cert.id);
      results.sent++;
    } catch (err) {
      db.prepare(`UPDATE certificates SET email_status = 'failed' WHERE id = ?`).run(cert.id);
      results.failed++;
      results.errors.push({ certificate_id: cert.id, error: errorMessage(err) });
    }
  }
  return results;
}

async function sendCertificateEmail(
  cert: CertificateRow,
  registrant: RegistrantRow,
  event: EventRow,
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim();
  if (!smtpHost || !smtpFrom) {
    throw new HttpError(503, 'Certificate email service is unavailable');
  }

  const pdfPath = path.join(certificatesDir, `${cert.verification_id}.pdf`);
  if (!cert.pdf_url || !fs.existsSync(pdfPath)) {
    throw new HttpError(409, 'Certificate PDF is unavailable');
  }

  const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const recipientName = escapeHtml(registrant.name);
  const eventTitle = escapeHtml(event.title);
  const certificateType = escapeHtml(cert.certificate_type);
  const verificationId = escapeHtml(cert.verification_id);
  await transporter.sendMail({
    from: smtpFrom,
    to: registrant.email,
    subject: `Your ${cert.certificate_type} certificate for ${event.title}`,
    text: `Hi ${registrant.name},\n\nYour ${cert.certificate_type} certificate for ${event.title} is attached.\nVerification ID: ${cert.verification_id}`,
    html: `<p>Hi ${recipientName},</p><p>Your ${certificateType} certificate for <strong>${eventTitle}</strong> is attached.</p><p>Verification ID: <code>${verificationId}</code></p>`,
    attachments: [{ filename: 'certificate.pdf', path: pdfPath }],
  });
}

interface NotificationPayload {
  userId: number;
  type: string;
  message: string;
  link?: string | null;
}

function createNotification({ userId, type, message, link }: NotificationPayload): void {
  try {
    db
      .prepare(
        `INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`,
      )
      .run(userId, type, message, link ?? null);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}