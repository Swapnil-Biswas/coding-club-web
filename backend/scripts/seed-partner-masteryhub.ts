import 'dotenv/config';
import { db } from '../src/db.js';

const name = 'MastryHub';
const logoUrl = '/uploads/sponsors/masteryhub_logo.png';
const website = 'https://mastryhub.com/';
const description = 'MastryHub is an ed-tech platform that helps students and developers master in-demand tech skills through structured learning paths, hands-on projects, and expert mentorship.';
const sortOrder = 0;

const existing = db.prepare('SELECT id FROM sponsors WHERE name = ?').get(name);

if (existing) {
  db.prepare('UPDATE sponsors SET logo_url = ?, website = ?, description = ?, sort_order = ? WHERE id = ?')
    .run(logoUrl, website, description, sortOrder, (existing as { id: number }).id);
  console.log('[seed] updated partner "' + name + '" (id=' + (existing as { id: number }).id + ')');
} else {
  const r = db.prepare('INSERT INTO sponsors (name, logo_url, website, description, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(name, logoUrl, website, description, sortOrder);
  console.log('[seed] created partner "' + name + '" (id=' + r.lastInsertRowid + ')');
}
