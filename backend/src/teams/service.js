import { db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { canCreateTeam, canManageTeam, canManageTeamMembers, isPresident, isAdmin } from '../lib/permissions.js';

function publicTeam(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    logo_url: row.logo_url,
    owner_core_head_id: row.owner_core_head_id,
    owner_name: row.owner_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- Queries ------------------------------------------------------------

// List all teams with owner info. Public.
export function listTeams() {
  const rows = db
    .prepare(
      `SELECT t.*, u.name as owner_name
       FROM teams t
       LEFT JOIN users u ON u.id = t.owner_core_head_id
       ORDER BY t.name ASC`,
    )
    .all();
  return rows.map(publicTeam);
}

export function getTeamById(id) {
  return db
    .prepare(
      `SELECT t.*, u.name as owner_name
       FROM teams t
       LEFT JOIN users u ON u.id = t.owner_core_head_id
       WHERE t.id = ?`,
    )
    .get(Number(id));
}

// List members of a team with their info. Public view only.
export function listTeamMembers(teamId) {
  return db
    .prepare(
      `SELECT tm.id, tm.team_id, tm.user_id, tm.designation, tm.display_order, tm.joined_at,
              u.name, u.email, u.role, u.club_title, u.profile_photo_path
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ?
       ORDER BY tm.display_order ASC, u.name ASC`,
    )
    .all(Number(teamId));
}

function publicMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    club_title: row.club_title || null,
    designation: row.designation || '',
    display_order: row.display_order,
    profile_photo_url: row.profile_photo_path ? `/uploads/${row.profile_photo_path}` : null,
    joined_at: row.joined_at,
  };
}

export function publicTeamMembers(teamId) {
  return listTeamMembers(teamId).map(publicMember);
}

// Get the teams a given user belongs to. Public.
export function getTeamsForUser(userId) {
  return db
    .prepare(
      `SELECT t.*,
              tm.designation,
              tm.display_order,
              tm.joined_at
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = ?
       ORDER BY t.name ASC`,
    )
    .all(Number(userId))
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      logo_url: row.logo_url,
      designation: row.designation || '',
      display_order: row.display_order,
      joined_at: row.joined_at,
    }));
}

// --- Mutations ----------------------------------------------------------

// Can create team (core_head, President, admin)
export function createTeam(actor, body) {
  if (!canCreateTeam(actor)) throw new HttpError(403, 'forbidden');
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  if (String(name).length > 100) throw new HttpError(400, 'team name too long');
  if (!body.description || typeof body.description !== 'string') {
    throw new HttpError(400, 'description is required');
  }
  const description = String(body.description).trim();
  const logo = body.logo_url ? String(body.logo_url).trim() : null;
  if (logo && (logo.length > 255 || !logo.startsWith('http'))) {
    throw new HttpError(400, 'invalid logo URL');
  }
  const existing = db.prepare(`SELECT id FROM teams WHERE name = ?`).get(name);
  if (existing) throw new HttpError(409, 'team name already exists');
  const result = db
    .prepare(
      `INSERT INTO teams (name, description, logo_url, owner_core_head_id) VALUES (?, ?, ?, ?)`
    )
    .run(name, description, logo, actor.id);
  return publicTeam(getTeamById(result.lastInsertRowid));
}

export function updateTeam(actor, id, body) {
  if (!canManageTeam(actor, id)) throw new HttpError(403, 'forbidden');
  const current = getTeamById(id);
  if (!current) throw new HttpError(404, 'team not found');
  const sets = [];
  const params = [];
  if (body.description !== undefined) {
    sets.push('description = ?');
    params.push(String(body.description).trim());
  }
  if (body.logo_url !== undefined) {
    const logo = body.logo_url ? String(body.logo_url).trim() : null;
    if (logo && (logo.length > 255 || !logo.startsWith('http'))) {
      throw new HttpError(400, 'invalid logo URL');
    }
    sets.push('logo_url = ?');
    params.push(logo);
  }
  if (sets.length === 0) return publicTeam(current);
  sets.push('updated_at = datetime(\'now\')');
  params.push(Number(id));
  db.prepare(`UPDATE teams SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return publicTeam(getTeamById(id));
}

export function deleteTeam(actor, id) {
  if (!canManageTeam(actor, id)) throw new HttpError(403, 'forbidden');
  const result = db.prepare(`DELETE FROM teams WHERE id = ?`).run(Number(id));
  if (result.changes === 0) throw new HttpError(404, 'team not found');
  return { ok: true };
}

export function addTeamMember(actor, teamId, body) {
  if (!canManageTeamMembers(actor, teamId)) throw new HttpError(403, 'forbidden');
  const team = getTeamById(teamId);
  if (!team) throw new HttpError(404, 'team not found');
  const userId = Number(body.user_id);
  if (!userId) throw new HttpError(400, 'user_id is required');
  const target = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(userId);
  if (!target) throw new HttpError(404, 'user not found');
  const allowed = ['core', 'core_head', 'admin'];
  if (!allowed.includes(target.role)) {
    throw new HttpError(400, 'only core, core_head, or admin users can be team members');
  }
  const designation = String(body.designation || '').trim();
  const displayOrder = Number.isFinite(Number(body.display_order)) ? Number(body.display_order) : 0;
  const existing = db
    .prepare(`SELECT id FROM team_members WHERE team_id = ? AND user_id = ?`)
    .get(Number(teamId), userId);
  if (existing) {
    db.prepare(`UPDATE team_members SET designation = ?, display_order = ? WHERE id = ?`)
      .run(designation, displayOrder, existing.id);
  } else {
    db.prepare(
      `INSERT INTO team_members (team_id, user_id, designation, display_order) VALUES (?, ?, ?, ?)`
    ).run(Number(teamId), userId, designation, displayOrder);
  }
  return publicMember(
    db
      .prepare(
        `SELECT tm.id, tm.team_id, tm.user_id, tm.designation, tm.display_order, tm.joined_at,
                u.name, u.email, u.role, u.club_title, u.profile_photo_path
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = ? AND tm.user_id = ?`
      )
      .get(Number(teamId), userId),
  );
}

export function updateTeamMember(actor, teamId, userId, body) {
  if (!canManageTeamMembers(actor, teamId)) throw new HttpError(403, 'forbidden');
  const existing = db
    .prepare(`SELECT id FROM team_members WHERE team_id = ? AND user_id = ?`)
    .get(Number(teamId), Number(userId));
  if (!existing) throw new HttpError(404, 'member not in team');
  const updates = {};
  if (body.designation !== undefined) {
    updates.designation = String(body.designation).trim();
  }
  if (body.display_order !== undefined) {
    updates.display_order = Number(body.display_order);
  }
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    return publicMember(
      db
        .prepare(
          `SELECT tm.id, tm.team_id, tm.user_id, tm.designation, tm.display_order, tm.joined_at,
                  u.name, u.email, u.role, u.club_title, u.profile_photo_path
           FROM team_members tm
           JOIN users u ON u.id = tm.user_id
           WHERE tm.team_id = ? AND tm.user_id = ?`
        )
        .get(Number(teamId), Number(userId)),
    );
  }
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const params = fields.map(f => updates[f]);
  params.push(existing.id);
  db.prepare(`UPDATE team_members SET ${setClause} WHERE id = ?`).run(...params);
  return publicMember(
    db
      .prepare(
        `SELECT tm.id, tm.team_id, tm.user_id, tm.designation, tm.display_order, tm.joined_at,
                u.name, u.email, u.role, u.club_title, u.profile_photo_path
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = ? AND tm.user_id = ?`
      )
      .get(Number(teamId), Number(userId)),
  );
}

export function removeTeamMember(actor, teamId, userId) {
  if (!canManageTeamMembers(actor, teamId)) throw new HttpError(403, 'forbidden');
  const result = db
    .prepare(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`)
    .run(Number(teamId), Number(userId));
  if (result.changes === 0) throw new HttpError(404, 'member not in team');
  return { ok: true };
}

export { publicTeam };
