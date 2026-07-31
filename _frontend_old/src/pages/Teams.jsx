import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Link } from 'react-router-dom';

// Public Teams page - shows all teams with members
export function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const data = await api('/teams');
      setTeams(data.teams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page"><div className="loading">Loading teams…</div></div>;
  if (error) return <div className="page"><div className="error">{error}</div></div>;

  return (
    <div className="page">
      <h1>Our Teams</h1>
      <p className="hint">
        Each team is led by a Core Head. Members can belong to multiple teams.
      </p>

      {teams.length === 0 ? (
        <div className="card info">No teams created yet.</div>
      ) : (
        <div className="teams-grid">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }) {
  const [members, setMembers] = useState([]);
  const [mLoading, setMLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) {
      api(`/teams/${team.id}/members`)
        .then((d) => setMembers(d.members || []))
        .finally(() => setMLoading(false));
    }
  }, [expanded, team.id]);

  return (
    <div className="team-card card">
      <div className="team-header">
        {team.logo_url && <img src={team.logo_url} alt="" className="team-logo" />}
        <div className="team-info">
          <h2>{team.name}</h2>
          {team.description && <p className="team-desc">{team.description}</p>}
          {team.owner_name && (
            <p className="team-owner">
              <strong>Lead:</strong> {team.owner_name}
            </p>
          )}
        </div>
      </div>

      <button
        className="btn-secondary"
        onClick={() => setExpanded(!expanded)}
        style={{ marginTop: '0.75rem' }}
      >
        {expanded ? 'Hide Members' : 'Show Members'}
      </button>

      {expanded && (
        <div className="team-members" style={{ marginTop: '1rem' }}>
          {mLoading ? (
            <div className="loading">Loading members…</div>
          ) : members.length === 0 ? (
            <div className="info">No members yet.</div>
          ) : (
            <div className="members-grid">
              {members.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }) {
  return (
    <Link to={`/profile/${member.user_id}`} className="member-card">
      {member.profile_photo_url && (
        <img src={member.profile_photo_url} alt="" className="member-photo" />
      )}
      <div className="member-details">
        <strong>{member.name}</strong>
        {member.club_title && <span className="club-title-badge">{member.club_title}</span>}
        <span className="member-role">{member.role}</span>
        {member.designation && <span className="designation">{member.designation}</span>}
      </div>
    </Link>
  );
}