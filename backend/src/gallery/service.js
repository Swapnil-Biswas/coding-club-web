import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canManagePhoto, canFeatureOrReorder } from '../lib/permissions.js';

function publicPhoto(row) {
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

export function listGallery({ limit, offset, eventId, featured } = {}) {
  let sql = `SELECT p.*, u.name as uploader_name FROM photos p LEFT JOIN users u ON u.id = p.uploaded_by`;
  const params = [];
  const conditions = [];

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
  const rows = db.prepare(sql).all(...params);
  return rows.map(publicPhoto);
}

export function getPhotoById(id) {
  return db
    .prepare(
      `SELECT p.*, u.name as uploader_name FROM photos p LEFT JOIN users u ON u.id = p.uploaded_by WHERE p.id = ?`,
    )
    .get(Number(id));
}

export function createPhoto(actor, body) {
  // Auth check (member+) is done at route level via requireRole.
  const uploadedBy = actor.id;
  const eventId = body.event_id ? Number(body.event_id) : null;
  const imageUrl = String(body.image_url || '').trim();
  const caption = String(body.caption || '').trim() || null;

  if (!imageUrl) throw new HttpError(400, 'image_url is required');

  if (eventId) {
    const event = db.prepare(`SELECT id FROM events WHERE id = ?`).get(eventId);
    if (!event) throw new HttpError(404, 'event not found');
  }

  // sort_order: append to end
  const maxOrderRow = eventId
    ? db.prepare(`SELECT MAX(sort_order) as max FROM photos WHERE event_id = ?`).get(eventId)
    : db.prepare(`SELECT MAX(sort_order) as max FROM photos`).get();
  const sortOrder = (maxOrderRow?.max ?? 0) + 1;

  const result = db
    .prepare(
      `INSERT INTO photos (uploaded_by, event_id, image_url, caption, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(uploadedBy, eventId, imageUrl, caption, sortOrder);

  return publicPhoto(getPhotoById(result.lastInsertRowid));
}

export function updatePhoto(actor, id, body) {
  const photo = getPhotoById(id);
  if (!photo) throw new HttpError(404, 'photo not found');
  if (!canManagePhoto(actor, photo)) {
    throw new HttpError(403, 'forbidden');
  }

  const sets = [];
  const params = [];

  if (body.caption !== undefined) {
    sets.push(`caption = ?`);
    params.push(String(body.caption || '').trim() || null);
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

export function deletePhoto(actor, id) {
  const photo = getPhotoById(id);
  if (!photo) throw new HttpError(404, 'photo not found');
  if (!canManagePhoto(actor, photo)) {
    throw new HttpError(403, 'forbidden');
  }
  db.prepare(`DELETE FROM photos WHERE id = ?`).run(Number(id));
  return { ok: true };
}

export function reorderGallery(actor, eventId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { ok: true };
  const tx = db.transaction((ids) => {
    ids.forEach((id, idx) => {
      db.prepare(`UPDATE photos SET sort_order = ? WHERE id = ?`).run(idx + 1, id);
    });
  });
  tx(orderedIds.map(Number));
  return { ok: true };
}