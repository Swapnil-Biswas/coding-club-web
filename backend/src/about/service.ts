import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canEditAboutPage } from '../lib/permissions.js';
import type { AboutPageContent, ActorLike } from '../lib/types.js';

function getAboutContent(): AboutPageContent {
  const row = db.prepare<AboutPageContent>(`SELECT content, updated_at FROM about_page WHERE id = 1`).get();
  if (!row) return { content: '', updated_at: null };
  return row;
}

export function getAboutPage(_actor: ActorLike | null): AboutPageContent {
  return getAboutContent();
}

export interface AboutPayload {
  content?: string;
}

export function updateAboutPage(actor: ActorLike, body: AboutPayload): AboutPageContent {
  if (!canEditAboutPage(actor)) throw new HttpError(403, 'forbidden');
  const content = String(body.content || '').trim();
  const existing = getAboutContent();
  if (existing.content === content) return getAboutContent();
  db.prepare(`UPDATE about_page SET content = ?, updated_at = datetime('now'), updated_by = ? WHERE id = 1`)
    .run(content, actor.id);
  return getAboutContent();
}
