import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';

const CATEGORIES = ['web', 'ai', 'mobile', 'open-source', 'other'];
const STATUSES   = ['shipped', 'wip', 'concept'];

function publicProject(row) {
  if (!row) return null;
  return {
    id:          row.id,
    title:       row.title,
    description: row.description,
    tags:        row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    category:    row.category,
    status:      row.status,
    author_name: row.author_name,
    year:        row.year,
    github_url:  row.github_url || null,
    live_url:    row.live_url   || null,
    featured:    Boolean(row.featured),
    sort_order:  row.sort_order,
    created_by:  row.created_by,
    creator_name: row.creator_name || null,
    created_at:  row.created_at,
    updated_at:  row.updated_at,
  };
}

export function listProjects({ category, status } = {}) {
  let sql = `
    SELECT p.*, u.name AS creator_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
  `;
  const params = [];
  const where  = [];

  if (category && category !== 'all') { where.push(`p.category = ?`); params.push(category); }
  if (status   && status   !== 'all') { where.push(`p.status = ?`);   params.push(status); }
  if (where.length) sql += ` WHERE ` + where.join(' AND ');
  sql += ` ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC`;

  return db.prepare(sql).all(...params).map(publicProject);
}

export function getProjectById(id) {
  const row = db.prepare(`
    SELECT p.*, u.name AS creator_name
    FROM projects p LEFT JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(Number(id));
  return publicProject(row);
}

export function createProject(actor, body) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Admin only');

  const title    = String(body.title       || '').trim();
  if (!title) throw new HttpError(400, 'title is required');

  const description = String(body.description || '').trim();
  const tags        = normalizeTags(body.tags);
  const category    = validate('category', body.category, CATEGORIES, 'web');
  const status      = validate('status',   body.status,   STATUSES,   'wip');
  const author_name = String(body.author_name || '').trim();
  const year        = String(body.year        || '').trim();
  const github_url  = normalizeUrl(body.github_url);
  const live_url    = normalizeUrl(body.live_url);
  const featured    = body.featured ? 1 : 0;

  const maxRow   = db.prepare(`SELECT MAX(sort_order) AS max FROM projects`).get();
  const sort_order = (maxRow?.max ?? 0) + 1;

  const result = db.prepare(`
    INSERT INTO projects (title, description, tags, category, status, author_name, year, github_url, live_url, featured, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, tags, category, status, author_name, year, github_url, live_url, featured, sort_order, actor.id);

  return getProjectById(result.lastInsertRowid);
}

export function updateProject(actor, id, body) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Admin only');
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(Number(id));
  if (!row) throw new HttpError(404, 'project not found');

  const sets   = [];
  const params = [];

  if (body.title       !== undefined) { sets.push(`title = ?`);       params.push(String(body.title       || '').trim()); }
  if (body.description !== undefined) { sets.push(`description = ?`); params.push(String(body.description || '').trim()); }
  if (body.tags        !== undefined) { sets.push(`tags = ?`);        params.push(normalizeTags(body.tags)); }
  if (body.category    !== undefined) { sets.push(`category = ?`);    params.push(validate('category', body.category, CATEGORIES, row.category)); }
  if (body.status      !== undefined) { sets.push(`status = ?`);      params.push(validate('status',   body.status,   STATUSES,   row.status)); }
  if (body.author_name !== undefined) { sets.push(`author_name = ?`); params.push(String(body.author_name || '').trim()); }
  if (body.year        !== undefined) { sets.push(`year = ?`);        params.push(String(body.year        || '').trim()); }
  if (body.github_url  !== undefined) { sets.push(`github_url = ?`);  params.push(normalizeUrl(body.github_url)); }
  if (body.live_url    !== undefined) { sets.push(`live_url = ?`);    params.push(normalizeUrl(body.live_url)); }
  if (body.featured    !== undefined) { sets.push(`featured = ?`);    params.push(body.featured ? 1 : 0); }
  if (body.sort_order  !== undefined) { sets.push(`sort_order = ?`);  params.push(Number(body.sort_order)); }

  if (sets.length === 0) return getProjectById(id);
  sets.push(`updated_at = datetime('now')`);
  params.push(Number(id));
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getProjectById(id);
}

export function deleteProject(actor, id) {
  if (actor.role !== 'admin') throw new HttpError(403, 'Admin only');
  const row = db.prepare(`SELECT id FROM projects WHERE id = ?`).get(Number(id));
  if (!row) throw new HttpError(404, 'project not found');
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(Number(id));
  return { ok: true };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).join(', ');
  return String(raw || '').split(',').map((t) => t.trim()).filter(Boolean).join(', ');
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function validate(field, value, allowed, fallback) {
  if (!value) return fallback;
  if (!allowed.includes(value)) throw new HttpError(400, `Invalid ${field}: ${value}`);
  return value;
}
