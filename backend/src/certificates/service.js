import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certificatesDir = path.resolve(__dirname, '..', '..', 'uploads', 'certificates');
const templatesDir = path.resolve(__dirname, '..', '..', 'uploads', 'templates');
fs.mkdirSync(certificatesDir, { recursive: true });
fs.mkdirSync(templatesDir, { recursive: true });

export const CERTIFICATE_TYPES = ['participation', 'winner', 'volunteer', 'speaker', 'organizer', 'special_recognition'];

// --- Templates ----------------------------------------------------------

export function listTemplates() {
  return db
    .prepare(
      `SELECT t.*, u.name as creator_name
       FROM certificate_templates t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY t.created_at DESC`,
    )
    .all();
}

export function getTemplateById(id) {
  return db.prepare(`SELECT * FROM certificate_templates WHERE id = ?`).get(Number(id));
}

export function createTemplate(actor, body) {
  if (!canUploadTemplate(actor)) throw new HttpError(403, 'forbidden');
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  const templateFile = body.template_file ? String(body.template_file).trim() : null;
  const previewImage = body.preview_image ? String(body.preview_image).trim() : null;
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
    entityId: result.lastInsertRowid,
    details: { name },
  });
  return getTemplateById(result.lastInsertRowid);
}

export function updateTemplate(actor, id, body) {
  const template = getTemplateById(id);
  if (!template) throw new HttpError(404, 'template not found');
  if (!canManageTemplate(actor, template)) throw new HttpError(403, 'forbidden');
  const sets = [];
  const params = [];
  if (body.name !== undefined) {
    sets.push('name = ?');
    params.push(String(body.name).trim());
  }
  if (body.preview_image !== undefined) {
    sets.push('preview_image = ?');
    params.push(body.preview_image ? String(body.preview_image).trim() : null);
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
export function generateCertificate(actor, { registrantId, certificateType, templateId }) {
  if (!CERTIFICATE_TYPES.includes(certificateType)) {
    throw new HttpError(400, 'invalid certificate_type');
  }
  const registrant = db
    .prepare(
      `SELECT r.*, e.id as event_id, e.title as event_title, e.organizer_id, e.status as event_status, e.start_datetime
       FROM event_registrants r
       JOIN events e ON e.id = r.event_id
       WHERE r.id = ?`,
    )
    .get(Number(registrantId));
  if (!registrant) throw new HttpError(404, 'registrant not found');
  if (!registrant.checked_in) {
    throw new HttpError(400, 'registrant has not checked in');
  }
  if (registrant.event_status !== 'completed') {
    throw new HttpError(400, 'event is not completed');
  }
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(registrant.event_id);
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');

  // Check if certificate already exists
  const existing = db
    .prepare(`SELECT * FROM certificates WHERE registrant_id = ? AND certificate_type = ?`)
    .get(Number(registrantId), certificateType);
  if (existing) {
    return { certificate: existing, duplicate: true };
  }

  const verificationId = uuidv4();
  const template = templateId ? getTemplateById(templateId) : null;
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
  const certRow = db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(result.lastInsertRowid);
  const pdfUrl = generateCertificatePdf(certRow, registrant, event, template);
  db.prepare(`UPDATE certificates SET pdf_url = ? WHERE id = ?`).run(pdfUrl, certRow.id);
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
  return { certificate: db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(certRow.id), duplicate: false };
}

export function bulkGenerateCertificates(actor, { eventId, certificateType, templateId, mode = 'checked_in' }) {
  if (!CERTIFICATE_TYPES.includes(certificateType)) {
    throw new HttpError(400, 'invalid certificate_type');
  }
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  if (event.status !== 'completed') throw new HttpError(400, 'event is not completed');

  let registrants;
  if (mode === 'all' || mode === 'checked_in') {
    registrants = db
      .prepare(`SELECT * FROM event_registrants WHERE event_id = ? AND checked_in = 1`)
      .all(event.id);
  } else if (mode === 'winners') {
    registrants = db
      .prepare(`SELECT * FROM event_registrants WHERE event_id = ? AND checked_in = 1`)
      .all(event.id);
  } else if (mode === 'volunteers') {
    registrants = db
      .prepare(
        `SELECT * FROM event_registrants WHERE event_id = ? AND checked_in = 1 AND LOWER(team_name) LIKE '%volunteer%'`,
      )
      .all(event.id);
  } else {
    throw new HttpError(400, 'invalid mode');
  }

  const results = { created: 0, skipped: 0, failed: 0, errors: [] };
  for (const registrant of registrants) {
    try {
      const { duplicate } = generateCertificate(actor, {
        registrantId: registrant.id,
        certificateType,
        templateId,
      });
      if (duplicate) results.skipped++;
      else results.created++;
    } catch (err) {
      results.failed++;
      results.errors.push({ registrant_id: registrant.id, error: err.message });
    }
  }
  return results;
}

function generateCertificatePdf(certificate, registrant, event, template) {
  const filename = `${certificate.verification_id}.pdf`;
  const filePath = path.join(certificatesDir, filename);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const writeStream = fs.createWriteStream(filePath);
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

  doc.end();
  return `/uploads/certificates/${filename}`;
}

// --- Verification ------------------------------------------------------

export function verifyCertificate(verificationId) {
  const cert = db
    .prepare(
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
    recipient_email: cert.recipient_email,
    team_name: cert.team_name,
    event_id: cert.event_id,
    event_title: cert.event_title,
    event_date: cert.event_date,
    venue: cert.venue,
    generated_at: cert.generated_at,
    generated_by_name: cert.generated_by_name,
    pdf_url: cert.pdf_url,
  };
}

export function getCertificateById(id) {
  return db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(Number(id));
}

export function listCertificatesForEvent(eventId, actor) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  return db
    .prepare(
      `SELECT c.*, r.name as recipient_name, r.email as recipient_email
       FROM certificates c
       JOIN event_registrants r ON r.id = c.registrant_id
       WHERE c.event_id = ?
       ORDER BY c.generated_at DESC`,
    )
    .all(Number(eventId));
}

export function listMyCertificates(actor) {
  if (!actor) throw new HttpError(401, 'authentication required');
  return db
    .prepare(
      `SELECT c.*, r.name as recipient_name, e.title as event_title, e.start_datetime
       FROM certificates c
       JOIN event_registrants r ON r.id = c.registrant_id
       JOIN events e ON e.id = c.event_id
       WHERE r.user_id = ?
       ORDER BY c.generated_at DESC`,
    )
    .all(actor.id);
}

// --- Email Delivery ----------------------------------------------------

export async function emailCertificate(actor, certificateId) {
  const cert = getCertificateById(certificateId);
  if (!cert) throw new HttpError(404, 'certificate not found');
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(cert.event_id);
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  const registrant = db.prepare(`SELECT * FROM event_registrants WHERE id = ?`).get(cert.registrant_id);
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
    return { ok: false, status: 'failed', error: err.message };
  }
}

export async function bulkEmailCertificates(actor, eventId) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(eventId));
  if (!event) throw new HttpError(404, 'event not found');
  if (!canManageEvent(actor, event)) throw new HttpError(403, 'forbidden');
  const certs = db
    .prepare(`SELECT * FROM certificates WHERE event_id = ?`)
    .all(Number(eventId));
  const results = { pending: 0, sent: 0, failed: 0, errors: [] };
  for (const cert of certs) {
    if (cert.email_status === 'sent') continue;
    try {
      const registrant = db.prepare(`SELECT * FROM event_registrants WHERE id = ?`).get(cert.registrant_id);
      await sendCertificateEmail(cert, registrant, event);
      db
        .prepare(`UPDATE certificates SET emailed_at = datetime('now'), email_status = 'sent' WHERE id = ?`)
        .run(cert.id);
      results.sent++;
    } catch (err) {
      db.prepare(`UPDATE certificates SET email_status = 'failed' WHERE id = ?`).run(cert.id);
      results.failed++;
      results.errors.push({ certificate_id: cert.id, error: err.message });
    }
  }
  return results;
}

async function sendCertificateEmail(cert, registrant, event) {
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@codingclub.edu',
      to: registrant.email,
      subject: `Your ${cert.certificate_type} certificate for ${event.title}`,
      html: `<p>Hi ${registrant.name},</p>
             <p>Your ${cert.certificate_type} certificate for <strong>${event.title}</strong> is attached.</p>
             <p>Verification ID: <code>${cert.verification_id}</code></p>`,
      attachments: cert.pdf_url
        ? [{ filename: 'certificate.pdf', path: path.join(certificatesDir, `${cert.verification_id}.pdf`) }]
        : [],
    });
  } else {
    console.log(`[email] Would email certificate to ${registrant.email}: ${cert.certificate_type} for ${event.title} (verification_id: ${cert.verification_id})`);
  }
}

function createNotification({ userId, type, message, link }) {
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