import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManageSponsors } from '../lib/permissions.js';

function publicSponsor(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    logo_url: row.logo_url,
    website: row.website,
    description: row.description,
    sort_order: row.sort_order,
  };
}

export function listSponsors() {
  return db
    .prepare(`SELECT * FROM sponsors ORDER BY sort_order ASC, id ASC`)
    .all()
    .map(publicSponsor);
}

export function getSponsorById(id) {
  return db.prepare(`SELECT * FROM sponsors WHERE id = ?`).get(Number(id));
}

export function createSponsor(actor, body) {
  if (!canManageSponsors(actor)) throw new HttpError(403, 'forbidden');
  const name = String(body.name || '').trim();
  const logoUrl = String(body.logo_url || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  if (!logoUrl) throw new HttpError(400, 'logo_url is required');
  if (!/^https?:\/\//i.test(logoUrl)) throw new HttpError(400, 'logo_url must be an http(s) URL');
  const website = body.website ? String(body.website).trim() : null;
  if (website && !/^https?:\/\//i.test(website)) throw new HttpError(400, 'website must be an http(s) URL');
  const description = String(body.description || '').trim();
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
  const result = db
    .prepare(
      `INSERT INTO sponsors (name, logo_url, website, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, logoUrl, website, description, sortOrder);
  return publicSponsor(getSponsorById(result.lastInsertRowid));
}

export function updateSponsor(actor, id, body) {
  if (!canManageSponsors(actor)) throw new HttpError(403, 'forbidden');
  const current = getSponsorById(id);
  if (!current) throw new HttpError(404, 'sponsor not found');
  const sets = [];
  const params = [];
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) throw new HttpError(400, 'name cannot be empty');
    sets.push('name = ?');
    params.push(n);
  }
  if (body.logo_url !== undefined) {
    const u = String(body.logo_url).trim();
    if (!u) throw new HttpError(400, 'logo_url cannot be empty');
    if (!/^https?:\/\//i.test(u)) throw new HttpError(400, 'logo_url must be an http(s) URL');
    sets.push('logo_url = ?');
    params.push(u);
  }
  if (body.website !== undefined) {
    const w = body.website ? String(body.website).trim() : null;
    if (w && !/^https?:\/\//i.test(w)) throw new HttpError(400, 'website must be an http(s) URL');
    sets.push('website = ?');
    params.push(w);
  }
  if (body.description !== undefined) {
    sets.push('description = ?');
    params.push(String(body.description).trim());
  }
  if (body.sort_order !== undefined) {
    sets.push('sort_order = ?');
    params.push(Number(body.sort_order));
  }
  if (sets.length === 0) return publicSponsor(current);
  params.push(Number(id));
  db.prepare(`UPDATE sponsors SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicSponsor(getSponsorById(id));
}

export function deleteSponsor(actor, id) {
  if (!canManageSponsors(actor)) throw new HttpError(403, 'forbidden');
  const result = db.prepare(`DELETE FROM sponsors WHERE id = ?`).run(Number(id));
  if (result.changes === 0) throw new HttpError(404, 'sponsor not found');
  return { ok: true };
}