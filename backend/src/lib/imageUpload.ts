import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import sharp from 'sharp';
import type * as sharpNs from 'sharp';
import type { RequestHandler } from 'express';
import { db } from '../db.js';
import { HttpError } from './errors.js';

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const IMAGE_MAX_DIMENSION = 12_000;
const IMAGE_MAX_PIXELS = 40_000_000;
const IMAGE_PROCESSING_CONCURRENCY = 4;
const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;

const ALLOWED_MIME = new Set<string>(IMAGE_ACCEPTED_TYPES);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
const temporaryUploadsDirectory = path.join(uploadsRoot, '.tmp');
fs.mkdirSync(temporaryUploadsDirectory, { recursive: true });

let activeImageProcessing = 0;

export type ImagePurpose = 'profiles' | 'gallery' | 'events' | 'mentors' | 'teams' | 'sponsors' | 'template-previews';

type SupportedFormat = 'jpeg' | 'png' | 'webp';

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, temporaryUploadsDirectory),
  filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
});

const imageUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: IMAGE_MAX_BYTES,
    files: 1,
    fields: 20,
    parts: 21,
    fieldSize: 64 * 1024,
    headerPairs: 100,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new HttpError(415, 'Only JPEG, PNG, and WebP images are supported'));
      return;
    }
    cb(null, true);
  },
});

async function removeFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await fs.promises.rm(filePath, { force: true });
  } catch (error) {
    console.error('[uploads] failed to remove file', { filePath, error });
  }
}

export function uploadSingleImage(fieldName: string): RequestHandler {
  const parse = imageUpload.single(fieldName);
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!req.destroyed) req.destroy(new Error('Image upload timed out'));
    }, IMAGE_UPLOAD_TIMEOUT_MS);
    timeout.unref();

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timeout);
      void removeFile(req.file?.path);
    };
    res.once('finish', cleanup);
    res.once('close', cleanup);
    req.once('aborted', cleanup);
    req.once('error', cleanup);

    parse(req, res, (error: unknown) => {
      clearTimeout(timeout);
      if (error) {
        cleanup();
        next(error);
        return;
      }
      next();
    });
  };
}

function detectedMime(format: SupportedFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function imageExtension(format: SupportedFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function isSupportedFormat(format: string | undefined): format is SupportedFormat {
  return format === 'jpeg' || format === 'png' || format === 'webp';
}

export async function saveImageFile(file: Express.Multer.File, purpose: ImagePurpose): Promise<string> {
  if (activeImageProcessing >= IMAGE_PROCESSING_CONCURRENCY) {
    throw new HttpError(503, 'Image uploads are busy, please try again shortly');
  }
  activeImageProcessing++;

  try {
    let metadata: sharpNs.Metadata;
    let stats: sharpNs.Stats;
    try {
      const image = sharp(file.path, {
        animated: true,
        failOn: 'error',
        limitInputPixels: IMAGE_MAX_PIXELS,
      });
      [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/pixel limit|image exceeds pixel limit|dimensions/i.test(message)) {
        throw new HttpError(413, 'Image dimensions are too large');
      }
      throw new HttpError(415, 'The selected file is not a valid JPEG, PNG, or WebP image');
    }

    if (!isSupportedFormat(metadata.format) || detectedMime(metadata.format) !== file.mimetype) {
      throw new HttpError(415, 'The selected file is not a valid JPEG, PNG, or WebP image');
    }

    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;
    const pages = metadata.pages ?? 1;
    const decodedPixels = width * height * pages;
    if (
      width < 1 ||
      height < 1 ||
      width > IMAGE_MAX_DIMENSION ||
      height > IMAGE_MAX_DIMENSION ||
      decodedPixels > IMAGE_MAX_PIXELS ||
      stats.channels.length === 0
    ) {
      throw new HttpError(413, 'Image dimensions are too large');
    }

    const directory = path.join(uploadsRoot, purpose);
    await fs.promises.mkdir(directory, { recursive: true });
    const filename = `${crypto.randomUUID()}.${imageExtension(metadata.format)}`;
    const filePath = path.join(directory, filename);
    await fs.promises.rename(file.path, filePath);
    return `/uploads/${purpose}/${filename}`;
  } finally {
    activeImageProcessing--;
    await removeFile(file.path);
  }
}

export function validateImageUrl(value: unknown, fieldName: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new HttpError(400, `${fieldName} is required`);
  if (raw.length > 2048) throw new HttpError(400, `${fieldName} is too long`);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, `${fieldName} must be a valid http(s) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new HttpError(400, `${fieldName} must be a valid http(s) URL`);
  }
  return url.toString();
}

export function validateImageReference(value: unknown, fieldName: string): string {
  const raw = String(value ?? '').trim();
  if (raw.startsWith('/uploads/')) return raw;
  return validateImageUrl(raw, fieldName);
}

export function publicImageReference(value: string | null | undefined, legacyDirectory = ''): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')) return value;
  const prefix = legacyDirectory ? `/uploads/${legacyDirectory}/` : '/uploads/';
  return `${prefix}${value}`;
}

function managedImagePath(reference: string | null | undefined): { reference: string; filePath: string } | null {
  if (!reference?.startsWith('/uploads/')) return null;
  const relativePath = reference.slice('/uploads/'.length);
  if (!relativePath) return null;
  const filePath = path.resolve(uploadsRoot, relativePath);
  const rootPrefix = `${uploadsRoot}${path.sep}`;
  if (!filePath.startsWith(rootPrefix)) return null;
  const canonicalRelativePath = path.relative(uploadsRoot, filePath).split(path.sep).join('/');
  return { reference: `/uploads/${canonicalRelativePath}`, filePath };
}

function isManagedImageReferenced(reference: string): boolean {
  const legacyEventReference = reference.startsWith('/uploads/events/')
    ? reference.slice('/uploads/events/'.length)
    : null;
  return Boolean(db.prepare(`
    SELECT 1 FROM users WHERE profile_photo_path = ?
    UNION ALL SELECT 1 FROM events WHERE banner_image_path = ? OR banner_image_path = ?
    UNION ALL SELECT 1 FROM teams WHERE logo_url = ?
    UNION ALL SELECT 1 FROM photos WHERE image_url = ?
    UNION ALL SELECT 1 FROM sponsors WHERE logo_url = ?
    UNION ALL SELECT 1 FROM certificate_templates WHERE preview_image = ?
    UNION ALL SELECT 1 FROM mentors WHERE photo_url = ?
    LIMIT 1
  `).get(
    reference,
    reference,
    legacyEventReference,
    reference,
    reference,
    reference,
    reference,
    reference,
  ));
}

export function enqueueManagedImageDeletion(reference: string | null | undefined): void {
  const managed = managedImagePath(reference);
  if (!managed) return;
  db.prepare(`
    INSERT INTO managed_image_deletion_queue(reference)
    VALUES (?)
    ON CONFLICT(reference) DO NOTHING
  `).run(managed.reference);
}

interface DeletionQueueRow {
  reference: string;
  attempts: number;
}

export async function processManagedImageDeletionQueue(limit = 50): Promise<void> {
  const rows = db.prepare<DeletionQueueRow>(`
    SELECT reference, attempts
    FROM managed_image_deletion_queue
    WHERE next_attempt_at <= unixepoch()
    ORDER BY next_attempt_at, created_at
    LIMIT ?
  `).all(limit);

  for (const row of rows) {
    const managed = managedImagePath(row.reference);
    if (!managed || isManagedImageReferenced(row.reference)) {
      db.prepare(`DELETE FROM managed_image_deletion_queue WHERE reference = ?`).run(row.reference);
      continue;
    }
    try {
      await fs.promises.rm(managed.filePath, { force: true });
      db.prepare(`DELETE FROM managed_image_deletion_queue WHERE reference = ?`).run(row.reference);
    } catch (error) {
      const attempts = row.attempts + 1;
      const delaySeconds = Math.min(3600, 5 * 2 ** Math.min(attempts, 9));
      const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown deletion error';
      db.prepare(`
        UPDATE managed_image_deletion_queue
        SET attempts = ?, last_error = ?, next_attempt_at = unixepoch() + ?
        WHERE reference = ?
      `).run(attempts, message, delaySeconds, row.reference);
    }
  }
}

export async function removeStaleTemporaryUploads(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  const entries = await fs.promises.readdir(temporaryUploadsDirectory, { withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
    const filePath = path.join(temporaryUploadsDirectory, entry.name);
    const stat = await fs.promises.stat(filePath);
    if (stat.mtimeMs < cutoff) await fs.promises.rm(filePath, { force: true });
  }));
}

export function deleteManagedImage(reference: string | null | undefined): void {
  const managed = managedImagePath(reference);
  if (!managed) return;
  void removeFile(managed.filePath);
}

export function deleteManagedImageIfUnreferenced(reference: string | null | undefined): void {
  enqueueManagedImageDeletion(reference);
}

export function requireSingleImageSource(file: Express.Multer.File | undefined, url: unknown, fieldName: string): void {
  if (file && String(url ?? '').trim()) {
    throw new HttpError(400, `Choose either an image file or ${fieldName}, not both`);
  }
  if (!file && !String(url ?? '').trim()) {
    throw new HttpError(400, `Choose an image file or provide ${fieldName}`);
  }
}
