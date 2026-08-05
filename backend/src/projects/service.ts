import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import type { ActorLike, ProjectCategory, ProjectRow, ProjectStatus, PublicProject } from '../lib/types.js';
import { booleanValue, httpUrl, integerValue, positiveId, stringValue } from '../lib/validation.js';

const CATEGORIES: readonly ProjectCategory[] = ['web', 'ai', 'mobile', 'open-source', 'other'];
const STATUSES: readonly ProjectStatus[] = ['shipped', 'wip', 'concept'];

export interface ProjectPayload {
  title?: string;
  description?: string;
  tags?: string | string[];
  category?: ProjectCategory;
  status?: ProjectStatus;
  author_name?: string;
  year?: string;
  github_url?: string | null;
  live_url?: string | null;
  featured?: boolean;
  sort_order?: number | string;
}

function publicProject(row: ProjectRow | null | undefined): PublicProject | null {
  if (!row) return null;
  return {
    id:          row.id,
    title:       row.title,
    description: row.description,
    tags:        row.tags ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
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

export function listProjects({ category, status }: { category?: string; status?: string } = {}): PublicProject[] {
  let sql = `
    SELECT p.*, u.name AS creator_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
  `;
  const params: string[] = [];
  const where: string[] = [];

  if (category && category !== 'all') { where.push(`p.category = ?`); params.push(category); }
  if (status   && status   !== 'all') { where.push(`p.status = ?`);   params.push(status); }
  if (where.length) sql += ` WHERE ` + where.join(' AND ');
  sql += ` ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC`;

  return db.prepare<ProjectRow>(sql).all(...params).map((row) => publicProject(row)!);
}

export function getProjectById(id: number | string | bigint): PublicProject | null {
  const row = db.prepare<ProjectRow>(`
    SELECT p.*, u.name AS creator_name
    FROM projects p LEFT JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(positiveId(id, 'project id'));
  return publicProject(row);
}

export function createProject(actor: ActorLike, body: ProjectPayload): PublicProject | null {
  if (actor.role !== 'admin') throw new HttpError(403, 'Admin only');

  const title = stringValue(body.title, { field: 'title', min: 1, max: 150 });
  const description = stringValue(body.description, { field: 'description', max: 5_000, required: false });
  const tags        = normalizeTags(body.tags);
  const category    = validate('category', body.category, CATEGORIES, 'web');
  const status      = validate('status',   body.status,   STATUSES,   'wip');
  const author_name = stringValue(body.author_name, { field: 'author_name', max: 100, required: false });
  const year        = stringValue(body.year, { field: 'year', max: 20, required: false });
  const github_url  = httpUrl(body.github_url, { field: 'github_url', allowedHosts: ['github.com'] });
  const live_url    = httpUrl(body.live_url, { field: 'live_url' });
  const featured    = body.featured === undefined ? 0 : Number(booleanValue(body.featured, 'featured'));

  const maxRow = db.prepare<{ max: number | null }>(`SELECT MAX(sort_order) AS max FROM projects`).get();
  const sort_order = (maxRow?.max ?? 0) + 1;

  const result = db.prepare(`
    INSERT INTO projects (title, description, tags, category, status, author_name, year, github_url, live_url, featured, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, tags, category, status, author_name, year, github_url, live_url, featured, sort_order, actor.id);

  return getProjectById(result.lastInsertRowid);
}

export function updateProject(actor: ActorLike, id: number | string, body: ProjectPayload): PublicProject | null {
  if (actor.role !== 'admin') throw new HttpError(403, 'Admin only');
  const row = db.prepare<ProjectRow>(`SELECT * FROM projects WHERE id = ?`).get(positiveId(id, 'project id'));
  if (!row) throw new HttpError(404, 'project not found');

  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.title       !== undefined) { sets.push(`title = ?`);       params.push(stringValue(body.title, { field: 'title', min: 1, max: 150 })); }
  if (body.description !== undefined) { sets.push(`description = ?`); params.push(stringValue(body.description, { field: 'description', max: 5_000, required: false })); }
  if (body.tags        !== undefined) { sets.push(`tags = ?`);        params.push(normalizeTags(body.tags)); }
  if (body.category    !== undefined) { sets.push(`category = ?`);    params.push(validate('category', body.category, CATEGORIES, row.category)); }
  if (body.status      !== undefined) { sets.push(`status = ?`);      params.push(validate('status',   body.status,   STATUSES,   row.status)); }
  if (body.author_name !== undefined) { sets.push(`author_name = ?`); params.push(stringValue(body.author_name, { field: 'author_name', max: 100, required: false })); }
  if (body.year        !== undefined) { sets.push(`year = ?`);        params.push(stringValue(body.year, { field: 'year', max: 20, required: false })); }
  if (body.github_url  !== undefined) { sets.push(`github_url = ?`);  params.push(httpUrl(body.github_url, { field: 'github_url', allowedHosts: ['github.com'] })); }
  if (body.live_url    !== undefined) { sets.push(`live_url = ?`);    params.push(httpUrl(body.live_url, { field: 'live_url' })); }
  if (body.featured    !== undefined) { sets.push(`featured = ?`);    params.push(Number(booleanValue(body.featured, 'featured'))); }
  if (body.sort_order  !== undefined) { sets.push(`sort_order = ?`);  params.push(integerValue(body.sort_order, { field: 'sort_order', min: 0, max: 100_000 })); }

  if (sets.length === 0) return getProjectById(id);
  sets.push(`updated_at = datetime('now')`);
  params.push(positiveId(id, 'project id'));
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getProjectById(id);
}

export function deleteProject(actor: ActorLike, id: number | string): { ok: true } {
  if (actor.role !== 'admin') throw new HttpError(403, 'Admin only');
  const row = db.prepare(`SELECT id FROM projects WHERE id = ?`).get(positiveId(id, 'project id'));
  if (!row) throw new HttpError(404, 'project not found');
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(positiveId(id, 'project id'));
  return { ok: true };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function normalizeTags(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).join(', ');
  return String(raw || '').split(',').map((t: string) => t.trim()).filter(Boolean).join(', ');
}

function validate<T extends string>(field: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  if (!allowed.includes(value as T)) throw new HttpError(400, `Invalid ${field}: ${value}`);
  return value as T;
}
