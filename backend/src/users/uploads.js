import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// 2MB ceiling. Profile photos are small; if someone wants more, that goes in
// a later phase. JPEG/PNG/WebP only — no SVG (XSS risk if rendered inline).
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_FOR = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  // Filename is derived in the route handler so we can use the user id and
  // mime. multer still wants a string here, so we set a placeholder and
  // rename in the handler if needed.
  filename: (_req, file, cb) => {
    const ext = EXT_FOR[file.mimetype] || 'bin';
    cb(null, `tmp-${Date.now()}.${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('only jpeg/png/webp allowed'));
    }
    cb(null, true);
  },
});

export { uploadsDir };
