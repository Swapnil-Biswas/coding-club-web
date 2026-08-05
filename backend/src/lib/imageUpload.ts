import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import type { RequestHandler } from 'express';
import { db } from '../db.js';
import { HttpError } from './errors.js';

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const IMAGE_MAX_DIMENSION = 12_000;
const IMAGE_MAX_PIXELS = 40_000_000;
const IMAGE_UPLOAD_CONCURRENCY = 4;

let activeImageUploads = 0;

export const admitImageUpload: RequestHandler = (req, res, next) => {
  if (activeImageUploads >= IMAGE_UPLOAD_CONCURRENCY) {
    next(new HttpError(503, 'Image uploads are busy, please try again shortly'));
    return;
  }
  activeImageUploads++;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    activeImageUploads--;
  };
  res.once('finish', release);
  res.once('close', release);
  next();
};

const ALLOWED_MIME = new Set<string>(IMAGE_ACCEPTED_TYPES);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');

export type ImagePurpose = 'profiles' | 'gallery' | 'events' | 'mentors' | 'teams' | 'sponsors' | 'template-previews';

export const imageUpload = multer({
  storage: multer.memoryStorage(),
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

interface ImageMetadata {
  mime: string;
  extension: string;
  width: number;
  height: number;
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  let dimensions: { width: number; height: number } | null = null;
  let foundScan = false;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++]!;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 8) return null;
      const components = buffer[offset + 7]!;
      if (components < 1 || segmentLength !== 8 + components * 3) return null;
      dimensions = {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    if (marker === 0xda) {
      foundScan = true;
      break;
    }
    offset += segmentLength;
  }
  if (!dimensions || !foundScan || buffer.length < 4) return null;
  if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
  return dimensions;
}

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 8;
  let dimensions: { width: number; height: number } | null = null;
  let foundData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + length;
    if (end > buffer.length) return null;
    if (!dimensions) {
      if (type !== 'IHDR' || length !== 13) return null;
      dimensions = {
        width: buffer.readUInt32BE(offset + 8),
        height: buffer.readUInt32BE(offset + 12),
      };
    } else if (type === 'IDAT') {
      foundData = true;
    } else if (type === 'IEND') {
      return length === 0 && foundData && end === buffer.length ? dimensions : null;
    }
    offset = end;
  }
  return null;
}

function webpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 20 || buffer.readUInt32LE(4) + 8 !== buffer.length) return null;
  let offset = 12;
  let extendedDimensions: { width: number; height: number } | null = null;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const end = dataOffset + chunkSize;
    if (end > buffer.length) return null;
    if (chunkType === 'VP8X') {
      if (chunkSize !== 10) return null;
      extendedDimensions = {
        width: 1 + buffer.readUIntLE(dataOffset + 4, 3),
        height: 1 + buffer.readUIntLE(dataOffset + 7, 3),
      };
    } else if (chunkType === 'VP8L') {
      if (chunkSize < 5 || buffer[dataOffset] !== 0x2f) return null;
      const bits = buffer.readUInt32LE(dataOffset + 1);
      return extendedDimensions ?? {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    } else if (chunkType === 'VP8 ') {
      if (
        chunkSize < 10 ||
        buffer[dataOffset + 3] !== 0x9d ||
        buffer[dataOffset + 4] !== 0x01 ||
        buffer[dataOffset + 5] !== 0x2a
      ) return null;
      return extendedDimensions ?? {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    } else if (chunkType === 'ANMF' && extendedDimensions && chunkSize >= 16) {
      return extendedDimensions;
    }
    offset = end + (chunkSize % 2);
  }
  return null;
}

function detectedImageType(buffer: Buffer): ImageMetadata | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const dimensions = jpegDimensions(buffer);
    return dimensions ? { mime: 'image/jpeg', extension: 'jpg', ...dimensions } : null;
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const dimensions = pngDimensions(buffer);
    return dimensions ? { mime: 'image/png', extension: 'png', ...dimensions } : null;
  }
  if (
    buffer.length >= 20 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const dimensions = webpDimensions(buffer);
    return dimensions ? { mime: 'image/webp', extension: 'webp', ...dimensions } : null;
  }
  return null;
}

export function saveImageFile(file: Express.Multer.File, purpose: ImagePurpose): string {
  const detected = detectedImageType(file.buffer);
  if (!detected || detected.mime !== file.mimetype) {
    throw new HttpError(415, 'The selected file is not a valid JPEG, PNG, or WebP image');
  }
  if (
    detected.width < 1 ||
    detected.height < 1 ||
    detected.width > IMAGE_MAX_DIMENSION ||
    detected.height > IMAGE_MAX_DIMENSION ||
    detected.width * detected.height > IMAGE_MAX_PIXELS
  ) {
    throw new HttpError(413, 'Image dimensions are too large');
  }

  const directory = path.join(uploadsRoot, purpose);
  fs.mkdirSync(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${detected.extension}`;
  const filePath = path.join(directory, filename);
  fs.writeFileSync(filePath, file.buffer, { flag: 'wx' });
  return `/uploads/${purpose}/${filename}`;
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

export function deleteManagedImage(reference: string | null | undefined): void {
  if (!reference?.startsWith('/uploads/')) return;
  const relativePath = reference.slice('/uploads/'.length);
  const resolved = path.resolve(uploadsRoot, relativePath);
  const rootPrefix = `${uploadsRoot}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) return;
  try {
    fs.unlinkSync(resolved);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      console.error('[uploads] failed to remove image', { reference, error });
    }
  }
}

export function deleteManagedImageIfUnreferenced(reference: string | null | undefined): void {
  if (!reference?.startsWith('/uploads/')) return;
  const legacyEventReference = reference.startsWith('/uploads/events/')
    ? reference.slice('/uploads/events/'.length)
    : null;
  const checks: Array<[string, unknown[]]> = [
    [`SELECT 1 FROM users WHERE profile_photo_path = ? LIMIT 1`, [reference]],
    [
      `SELECT 1 FROM events WHERE banner_image_path = ? OR banner_image_path = ? LIMIT 1`,
      [reference, legacyEventReference],
    ],
    [`SELECT 1 FROM teams WHERE logo_url = ? LIMIT 1`, [reference]],
    [`SELECT 1 FROM photos WHERE image_url = ? LIMIT 1`, [reference]],
    [`SELECT 1 FROM sponsors WHERE logo_url = ? LIMIT 1`, [reference]],
    [`SELECT 1 FROM certificate_templates WHERE preview_image = ? LIMIT 1`, [reference]],
    [`SELECT 1 FROM mentors WHERE photo_url = ? LIMIT 1`, [reference]],
  ];
  for (const [sql, parameters] of checks) {
    if (db.prepare(sql).get(...parameters)) return;
  }
  deleteManagedImage(reference);
}

export function requireSingleImageSource(file: Express.Multer.File | undefined, url: unknown, fieldName: string): void {
  if (file && String(url ?? '').trim()) {
    throw new HttpError(400, `Choose either an image file or ${fieldName}, not both`);
  }
  if (!file && !String(url ?? '').trim()) {
    throw new HttpError(400, `Choose an image file or provide ${fieldName}`);
  }
}
