import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { publicImageReference, validateImageReference } from '../lib/imageUpload.js';
import { canManageSponsors } from '../lib/permissions.js';
import type { ActorLike, PublicSponsor, SponsorRow } from '../lib/types.js';
import { httpUrl, integerValue, positiveId, stringValue } from '../lib/validation.js';

function publicSponsor(row: SponsorRow | null | undefined): PublicSponsor | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    logo_url: publicImageReference(row.logo_url) ?? row.logo_url,
    website: row.website,
    description: row.description,
    sort_order: row.sort_order,
  };
}

export interface SponsorPayload {
  name?: string;
  logo_url?: string;
  website?: string | null;
  description?: string;
  sort_order?: number | string;
}

export function listSponsors(): PublicSponsor[] {
  return db
    .prepare<SponsorRow>(`SELECT * FROM sponsors ORDER BY sort_order ASC, id ASC`)
    .all()
    .map((row) => publicSponsor(row)!);
}

export function getSponsorById(id: number | string | bigint): SponsorRow | undefined {
  return db.prepare<SponsorRow>(`SELECT * FROM sponsors WHERE id = ?`).get(positiveId(id, 'sponsor id'));
}

export function createSponsor(actor: ActorLike, body: SponsorPayload): PublicSponsor | null {
  if (!canManageSponsors(actor)) throw new HttpError(403, 'forbidden');
  const name = stringValue(body.name, { field: 'name', min: 1, max: 150 });
  const logoUrl = validateImageReference(body.logo_url, 'logo_url');
  const website = httpUrl(body.website, { field: 'website' });
  const description = stringValue(body.description, { field: 'description', max: 2_000, required: false });
  const sortOrder = integerValue(body.sort_order, {
    field: 'sort_order',
    min: 0,
    max: 100_000,
    defaultValue: 0,
  });
  const result = db
    .prepare(
      `INSERT INTO sponsors (name, logo_url, website, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(name, logoUrl, website, description, sortOrder);
  return publicSponsor(getSponsorById(result.lastInsertRowid));
}

export function updateSponsor(
  actor: ActorLike,
  id: number | string,
  body: SponsorPayload,
): PublicSponsor | null {
  if (!canManageSponsors(actor)) throw new HttpError(403, 'forbidden');
  const current = getSponsorById(id);
  if (!current) throw new HttpError(404, 'sponsor not found');
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) {
    sets.push('name = ?');
    params.push(stringValue(body.name, { field: 'name', min: 1, max: 150 }));
  }
  if (body.logo_url !== undefined) {
    sets.push('logo_url = ?');
    params.push(validateImageReference(body.logo_url, 'logo_url'));
  }
  if (body.website !== undefined) {
    sets.push('website = ?');
    params.push(httpUrl(body.website, { field: 'website' }));
  }
  if (body.description !== undefined) {
    sets.push('description = ?');
    params.push(stringValue(body.description, { field: 'description', max: 2_000, required: false }));
  }
  if (body.sort_order !== undefined) {
    sets.push('sort_order = ?');
    params.push(integerValue(body.sort_order, { field: 'sort_order', min: 0, max: 100_000 }));
  }
  if (sets.length === 0) return publicSponsor(current);
  params.push(positiveId(id, 'sponsor id'));
  db.prepare(`UPDATE sponsors SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicSponsor(getSponsorById(id));
}

export function deleteSponsor(actor: ActorLike, id: number | string): { ok: true } {
  if (!canManageSponsors(actor)) throw new HttpError(403, 'forbidden');
  const result = db.prepare(`DELETE FROM sponsors WHERE id = ?`).run(positiveId(id, 'sponsor id'));
  if (result.changes === 0) throw new HttpError(404, 'sponsor not found');
  return { ok: true };
}
