import 'dotenv/config';
import { db } from '../src/db.js';

const name = 'Reskilll';
const logoUrl = '/uploads/sponsors/reskilll_logo.png';
const website = 'https://reskilll.com/';
const description = "India's leading hackathon and developer platform, empowering students and tech communities through hackathons, coding challenges, innovation sprints, and real-world opportunities.";
const sortOrder = 1;

const existing = db.prepare('SELECT id FROM sponsors WHERE name = ? COLLATE NOCASE').get(name);

if (existing) {
  db.prepare('UPDATE sponsors SET name = ?, logo_url = ?, website = ?, description = ?, sort_order = ? WHERE id = ?')
    .run(name, logoUrl, website, description, sortOrder, (existing as { id: number }).id);
  console.log('[seed] updated partner "' + name + '" (id=' + (existing as { id: number }).id + ')');
} else {
  const r = db.prepare('INSERT INTO sponsors (name, logo_url, website, description, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(name, logoUrl, website, description, sortOrder);
  console.log('[seed] created partner "' + name + '" (id=' + r.lastInsertRowid + ')');
}
