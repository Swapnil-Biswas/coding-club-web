import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import {
  canSubmitBuilderRepo,
  canReviewBuilderRepo,
  canDeleteBuilderRepo,
  roleAtLeast,
} from '../lib/permissions.js';
import { positiveId, stringValue, httpUrl } from '../lib/validation.js';
import type {
  ActorLike,
  BuilderRepoRow,
  BuilderRepoStatus,
  BuilderRepoCategory,
  PublicBuilderRepo,
} from '../lib/types.js';

const VALID_STATUSES: readonly BuilderRepoStatus[] = ['pending', 'approved', 'rejected'];
const VALID_CATEGORIES: readonly BuilderRepoCategory[] = [
  'web', 'ai', 'mobile', 'open-source', 'cli', 'api', 'game', 'other',
];

// Only allow GitHub repo URLs (not raw content, gist, etc.)
const GITHUB_REPO_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/)?$/i;

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter((t) => t.length > 0)
    .slice(0, 10);
}

function serializeTags(tags: string[]): string {
  return parseTags(tags.join(',')).join(',');
}

function serialize(row: BuilderRepoRow | null | undefined): PublicBuilderRepo | null {
  if (!row) return null;
  return {
    id: row.id,
    submitted_by: row.submitted_by,
    submitter_name: row.submitter_name ?? null,
    repo_name: row.repo_name,
    repo_url: row.repo_url,
    description: row.description,
    tags: parseTags(row.tags),
    category: row.category,
    looking_for_contributors: Boolean(row.looking_for_contributors),
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewer_name: row.reviewer_name ?? null,
    reviewed_at: row.reviewed_at,
    review_notes: row.review_notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_JOIN = `
  SELECT
    br.*,
    u.name  AS submitter_name,
    rv.name AS reviewer_name
  FROM builder_repos br
  JOIN users u ON u.id = br.submitted_by
  LEFT JOIN users rv ON rv.id = br.reviewed_by
`;

// ---------------------------------------------------------------------------
// Submission

export interface SubmitBuilderRepoPayload {
  repo_name?: unknown;
  repo_url?: unknown;
  description?: unknown;
  tags?: unknown;
  category?: unknown;
  looking_for_contributors?: unknown;
}

export function submitBuilderRepo(
  actor: ActorLike,
  body: SubmitBuilderRepoPayload,
): PublicBuilderRepo {
  if (!canSubmitBuilderRepo(actor)) throw new HttpError(403, 'forbidden -- member role required to submit a repo');

  const repoName = stringValue(body.repo_name, { field: 'repo_name', min: 1, max: 100 });
  const repoUrl  = httpUrl(body.repo_url, { field: 'repo_url', required: true, allowedHosts: ['github.com'] })!;

  if (!GITHUB_REPO_RE.test(repoUrl)) {
    throw new HttpError(400, 'repo_url must be a GitHub repository URL (e.g. https://github.com/user/repo)');
  }

  const description = stringValue(body.description, { field: 'description', min: 10, max: 1000 });

  const rawTags = Array.isArray(body.tags)
    ? (body.tags as string[]).join(',')
    : typeof body.tags === 'string'
      ? body.tags
      : '';
  const tags = serializeTags([rawTags]);

  const category = body.category as BuilderRepoCategory | undefined;
  if (category && !VALID_CATEGORIES.includes(category)) {
    throw new HttpError(400, 'category must be one of: ' + VALID_CATEGORIES.join(', '));
  }

  const lookingForContributors =
    body.looking_for_contributors === false || body.looking_for_contributors === 0
      ? 0
      : 1;

  // Prevent the same user from spamming pending submissions for the same URL.
  const existingPending = db
    .prepare<{ id: number }>(
      `SELECT id FROM builder_repos WHERE submitted_by = ? AND repo_url = ? AND status = 'pending' LIMIT 1`,
    )
    .get(actor.id, repoUrl);
  if (existingPending) {
    throw new HttpError(
      409,
      'You already have a pending submission for this repository. Wait for it to be reviewed before resubmitting.',
    );
  }

  // Also block if there is already an approved entry for the same URL from anyone.
  const existingApproved = db
    .prepare<{ id: number }>(
      `SELECT id FROM builder_repos WHERE repo_url = ? AND status = 'approved' LIMIT 1`,
    )
    .get(repoUrl);
  if (existingApproved) {
    throw new HttpError(409, 'This repository is already listed on BMSIT Builders.');
  }

  const result = db
    .prepare(
      `INSERT INTO builder_repos
         (submitted_by, repo_name, repo_url, description, tags, category, looking_for_contributors, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      actor.id,
      repoName,
      repoUrl,
      description,
      tags,
      category ?? 'other',
      lookingForContributors,
    );

  const row = db
    .prepare<BuilderRepoRow>(`${SELECT_JOIN} WHERE br.id = ?`)
    .get(result.lastInsertRowid);

  return serialize(row)!;
}

// ---------------------------------------------------------------------------
// Listing

export interface ListBuilderReposOptions {
  status?: BuilderRepoStatus | 'all';
  category?: BuilderRepoCategory;
  seeking?: boolean;
  limit?: number;
  offset?: number;
}

export function listBuilderRepos(
  actor: ActorLike | null,
  opts: ListBuilderReposOptions = {},
): PublicBuilderRepo[] {
  const isReviewer = canReviewBuilderRepo(actor);

  let statusFilter: BuilderRepoStatus | 'all';
  if (isReviewer && opts.status) {
    statusFilter = opts.status;
  } else if (actor && roleAtLeast(actor.role, 'member') && opts.status === 'all') {
    statusFilter = 'all';
  } else {
    statusFilter = 'approved';
  }

  const wheres: string[] = [];
  const params: unknown[] = [];

  if (statusFilter === 'all') {
    if (!isReviewer && actor) {
      wheres.push(`(br.status = 'approved' OR br.submitted_by = ?)`);
      params.push(actor.id);
    }
  } else {
    wheres.push(`br.status = ?`);
    params.push(statusFilter);
  }

  if (opts.category) {
    if (!VALID_CATEGORIES.includes(opts.category)) throw new HttpError(400, 'invalid category');
    wheres.push(`br.category = ?`);
    params.push(opts.category);
  }

  if (opts.seeking) {
    wheres.push(`br.looking_for_contributors = 1`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const limit  = Math.min(Number(opts.limit)  || 50, 100);
  const offset = Number(opts.offset) || 0;

  const rows = db
    .prepare<BuilderRepoRow>(`${SELECT_JOIN} ${where} ORDER BY br.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return rows.map((r) => serialize(r)!);
}

export function listMyBuilderRepos(actor: ActorLike): PublicBuilderRepo[] {
  const rows = db
    .prepare<BuilderRepoRow>(`${SELECT_JOIN} WHERE br.submitted_by = ? ORDER BY br.created_at DESC`)
    .all(actor.id);
  return rows.map((r) => serialize(r)!);
}

export function getBuilderRepo(
  actor: ActorLike | null,
  id: number | string,
): PublicBuilderRepo {
  const repoId = positiveId(id, 'repo id');
  const row = db
    .prepare<BuilderRepoRow>(`${SELECT_JOIN} WHERE br.id = ?`)
    .get(repoId);
  if (!row) throw new HttpError(404, 'builder repo not found');

  const isReviewer = canReviewBuilderRepo(actor);
  const isOwner = actor && row.submitted_by === actor.id;
  if (row.status !== 'approved' && !isReviewer && !isOwner) {
    throw new HttpError(404, 'builder repo not found');
  }
  return serialize(row)!;
}

// ---------------------------------------------------------------------------
// Review (core_head+)

export interface ReviewBuilderRepoPayload {
  status?: BuilderRepoStatus;
  review_notes?: unknown;
}

export function reviewBuilderRepo(
  actor: ActorLike,
  id: number | string,
  body: ReviewBuilderRepoPayload,
): PublicBuilderRepo {
  if (!canReviewBuilderRepo(actor)) throw new HttpError(403, 'forbidden -- core head required');

  const repoId = positiveId(id, 'repo id');
  const current = db.prepare<BuilderRepoRow>(`SELECT * FROM builder_repos WHERE id = ?`).get(repoId);
  if (!current) throw new HttpError(404, 'builder repo not found');

  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      throw new HttpError(400, 'status must be one of: ' + VALID_STATUSES.join(', '));
    }
    sets.push('status = ?');
    params.push(body.status);
    sets.push('reviewed_by = ?');
    params.push(actor.id);
    sets.push(`reviewed_at = datetime('now')`);
  }

  if (body.review_notes !== undefined) {
    sets.push('review_notes = ?');
    params.push(stringValue(body.review_notes, { field: 'review_notes', max: 1000, required: false }));
  }

  if (sets.length === 0) return getBuilderRepo(actor, repoId);

  sets.push(`updated_at = datetime('now')`);
  params.push(repoId);

  db.prepare(`UPDATE builder_repos SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  return getBuilderRepo(actor, repoId);
}

// ---------------------------------------------------------------------------
// Delete

export function deleteBuilderRepo(actor: ActorLike, id: number | string): void {
  const repoId = positiveId(id, 'repo id');
  const row = db.prepare<BuilderRepoRow>(`SELECT * FROM builder_repos WHERE id = ?`).get(repoId);
  if (!row) throw new HttpError(404, 'builder repo not found');

  if (!canDeleteBuilderRepo(actor, row.submitted_by, row.status)) {
    throw new HttpError(403, 'forbidden');
  }

  db.prepare(`DELETE FROM builder_repos WHERE id = ?`).run(repoId);
}
