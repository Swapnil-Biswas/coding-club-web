import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads', 'events');
fs.mkdirSync(uploadsDir, { recursive: true });

// 4MB ceiling for banners — slightly higher than profile photos since banners
// span the page width. JPEG/PNG/WebP only.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_FOR: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = EXT_FOR[file.mimetype] || 'bin';
    cb(null, `tmp-${Date.now()}.${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('only jpeg/png/webp allowed'));
    }
    cb(null, true);
  },
});

export { uploadsDir };
