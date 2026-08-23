import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { enqueueManagedImageDeletion, validateImageReference } from '../lib/imageUpload.js';
import { canManagePhoto, canFeatureOrReorder, canManageAllPhotos } from '../lib/permissions.js';
import type { ActorLike, PhotoRow, PublicPhoto } from '../lib/types.js';

type Id = number | string;

interface GalleryFilters {
  limit?: number;
  offset?: number;
  eventId?: number;
  featured?: boolean;
}

interface CreatePhotoPayload {
  event_id?: unknown;
  image_url?: unknown;
  caption?: unknown;
}

interface UpdatePhotoPayload {
  caption?: unknown;
  is_featured?: unknown;
  sort_order?: unknown;
}

function publicPhoto(row: PhotoRow | null | undefined): PublicPhoto | null {
  if (!row) return null;
  return {
    id: row.id,
    uploaded_by: row.uploaded_by,
    uploader_name: row.uploader_name || null,
    event_id: row.event_id,
    image_url: row.image_url,
    caption: row.caption,
    is_featured: Boolean(row.is_featured),
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

export function listGallery({ limit, offset, eventId, featured }: GalleryFilters = {}): Array<PublicPhoto | null> {
  let sql = `SELECT p.*, u.name as uploader_name FROM photos p LEFT JOIN users u ON u.id = p.uploaded_by`;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (eventId !== undefined) {
    conditions.push(`p.event_id = ?`);
    params.push(eventId);
  }
  if (featured !== undefined) {
    conditions.push(`p.is_featured = ?`);
    params.push(featured ? 1 : 0);
  }
  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY p.sort_order ASC, p.created_at DESC`;
  if (limit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(limit);
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }
  }
  const rows = db.prepare<PhotoRow>(sql).all(...params);
  return rows.map(publicPhoto);
}

export function getPhotoById(id: Id): PhotoRow | undefined {
  return db
    .prepare<PhotoRow>(
      `SELECT p.*, u.name as uploader_name FROM photos p LEFT JOIN users u ON u.id = p.uploaded_by WHERE p.id = ?`,
    )
    .get(Number(id));
}

export function createPhoto(actor: ActorLike, body: CreatePhotoPayload): PublicPhoto | null {
  // Auth check (member+) is done at route level via requireRole.
  const uploadedBy = actor.id;
  const eventId = body.event_id ? Number(body.event_id) : null;
  const imageUrl = validateImageReference(body.image_url, 'image_url');
  const caption = String(body.caption || '').trim();

  if (eventId) {
    const event = db.prepare<{ id: number }>(`SELECT id FROM events WHERE id = ?`).get(eventId);
    if (!event) throw new HttpError(404, 'event not found');
  }

  // sort_order: append to end
  const maxOrderRow = eventId
    ? db.prepare<{ max: number | null }>(`SELECT MAX(sort_order) as max FROM photos WHERE event_id = ?`).get(eventId)
    : db.prepare<{ max: number | null }>(`SELECT MAX(sort_order) as max FROM photos`).get();
  const sortOrder = (maxOrderRow?.max ?? 0) + 1;

  const result = db
    .prepare(
      `INSERT INTO photos (uploaded_by, event_id, image_url, caption, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(uploadedBy, eventId, imageUrl, caption, sortOrder);

  return publicPhoto(getPhotoById(Number(result.lastInsertRowid)));
}

export function updatePhoto(actor: ActorLike, id: Id, body: UpdatePhotoPayload): PublicPhoto | null {
  const photo = getPhotoById(id);
  if (!photo) throw new HttpError(404, 'photo not found');
  if (!canManagePhoto(actor, photo)) {
    throw new HttpError(403, 'forbidden');
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.caption !== undefined) {
    sets.push(`caption = ?`);
    params.push(String(body.caption || '').trim());
  }
  if (body.is_featured !== undefined) {
    if (!canFeatureOrReorder(actor, photo)) throw new HttpError(403, 'forbidden');
    sets.push(`is_featured = ?`);
    params.push(Boolean(body.is_featured) ? 1 : 0);
  }
  if (body.sort_order !== undefined) {
    if (!canFeatureOrReorder(actor, photo)) throw new HttpError(403, 'forbidden');
    sets.push(`sort_order = ?`);
    params.push(Number(body.sort_order));
  }
  if (sets.length === 0) return publicPhoto(photo);

  params.push(Number(id));
  db.prepare(`UPDATE photos SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicPhoto(getPhotoById(id));
}

export function deletePhoto(actor: ActorLike, id: Id): { ok: true } {
  const photo = getPhotoById(id);
  if (!photo) throw new HttpError(404, 'photo not found');
  if (!canManagePhoto(actor, photo)) {
    throw new HttpError(403, 'forbidden');
  }
  db.prepare(`DELETE FROM photos WHERE id = ?`).run(Number(id));
  enqueueManagedImageDeletion(photo.image_url);
  return { ok: true };
}

export function reorderGallery(actor: ActorLike, eventId: number, orderedIds: unknown[]): { ok: true } {
  if (!canManageAllPhotos(actor)) throw new HttpError(403, 'forbidden');
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new HttpError(400, 'invalid event_id');
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { ok: true };
  if (orderedIds.length > 100) throw new HttpError(400, 'ordered_ids cannot contain more than 100 photos');

  const ids = orderedIds.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new HttpError(400, 'ordered_ids must contain positive integer IDs');
  }
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'ordered_ids contains duplicates');

  const placeholders = ids.map(() => '?').join(', ');
  const matching = db.prepare<{ id: number }>(
    `SELECT id FROM photos WHERE event_id = ? AND id IN (${placeholders})`,
  ).all(eventId, ...ids);
  if (matching.length !== ids.length) throw new HttpError(400, 'all photos must belong to the requested event');

  const update = db.prepare(`UPDATE photos SET sort_order = ? WHERE id = ? AND event_id = ?`);
  db.transaction(() => {
    ids.forEach((id, index) => {
      if (update.run(index + 1, id, eventId).changes !== 1) {
        throw new HttpError(409, 'gallery changed while it was being reordered');
      }
    });
  })();
  return { ok: true };
}