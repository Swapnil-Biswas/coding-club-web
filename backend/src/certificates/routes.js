import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  generateCertificate,
  bulkGenerateCertificates,
  verifyCertificate,
  listCertificatesForEvent,
  listMyCertificates,
  emailCertificate,
  bulkEmailCertificates,
} from './service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const certificatesRouter = Router();

// --- Templates ----------------------------------------------------------

// GET /certificates/templates - list all templates (core_head, President, admin)
certificatesRouter.get(
  '/certificates/templates',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (_req, res) => {
    res.json({ templates: listTemplates() });
  }),
);

// GET /certificates/templates/:id - get template (core_head, President, admin)
certificatesRouter.get(
  '/certificates/templates/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const template = getTemplateById(req.params.id);
    if (!template) throw new HttpError(404, 'template not found');
    res.json({ template });
  }),
);

// POST /certificates/templates - create template (core_head, President, admin)
certificatesRouter.post(
  '/certificates/templates',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const template = createTemplate(req.user, req.body || {});
    res.status(201).json({ template });
  }),
);

// PATCH /certificates/templates/:id - update template (owner core_head, President, admin)
certificatesRouter.patch(
  '/certificates/templates/:id',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const template = updateTemplate(req.user, req.params.id, req.body || {});
    res.json({ template });
  }),
);

// --- Certificate Generation ---------------------------------------------

// POST /events/:id/certificates/generate - generate single certificate
certificatesRouter.post(
  '/events/:id/certificates/generate',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const { registrant_id, certificate_type, template_id } = req.body || {};
    if (!registrant_id || !certificate_type) throw new HttpError(400, 'registrant_id and certificate_type required');
    const result = generateCertificate(req.user, {
      registrantId: registrant_id,
      certificateType: certificate_type,
      templateId: template_id,
    });
    res.status(201).json(result);
  }),
);

// POST /events/:id/certificates/generate/bulk - bulk generate certificates
certificatesRouter.post(
  '/events/:id/certificates/generate/bulk',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const { certificate_type, template_id, mode = 'checked_in' } = req.body || {};
    if (!certificate_type) throw new HttpError(400, 'certificate_type required');
    const result = bulkGenerateCertificates(req.user, {
      eventId,
      certificateType: certificate_type,
      templateId: template_id,
      mode,
    });
    res.json(result);
  }),
);

// GET /events/:id/certificates - list certificates for event (core_head owner, President, admin)
certificatesRouter.get(
  '/events/:id/certificates',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const certs = listCertificatesForEvent(req.params.id, req.user);
    res.json({ certificates: certs });
  }),
);

// --- Certificate Verification & Download --------------------------------

// GET /verify/:verificationId - public verification page data
certificatesRouter.get(
  '/verify/:verificationId',
  asyncHandler(async (req, res) => {
    const data = verifyCertificate(req.params.verificationId);
    if (!data) throw new HttpError(404, 'certificate not found');
    res.json({ certificate: data });
  }),
);

// GET /users/me/certificates - my certificates
certificatesRouter.get(
  '/users/me/certificates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const certs = listMyCertificates(req.user);
    res.json({ certificates: certs });
  }),
);

// --- Email Delivery -----------------------------------------------------

// POST /events/:id/certificates/email - email single certificate
certificatesRouter.post(
  '/events/:id/certificates/email',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const { certificate_id } = req.body || {};
    if (!certificate_id) throw new HttpError(400, 'certificate_id required');
    const result = await emailCertificate(req.user, certificate_id);
    res.json(result);
  }),
);

// POST /events/:id/certificates/email/bulk - bulk email certificates
certificatesRouter.post(
  '/events/:id/certificates/email/bulk',
  requireAuth,
  requireRole('core_head', 'admin'),
  asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);
    const result = await bulkEmailCertificates(req.user, eventId);
    res.json(result);
  }),
);
