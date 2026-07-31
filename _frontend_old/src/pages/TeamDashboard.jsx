import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Team Dashboard for core_head+ (President gets all teams)
export function TeamDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isPresident = user?.role === 'core_head' && user?.club_title === 'President';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      if (isPresident || isAdmin) {
        const data = await api('/teams');
        setTeams(data.teams || []);
      } else {
        // Core head sees only their owned teams
        const data = await api('/teams');
        const owned = (data.teams || []).filter((t) => t.owner_core_head_id === user.id);
        setTeams(owned);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onCreateTeam = async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const description = e.target.description.value.trim();
    const logoUrl = e.target.logoUrl.value.trim() || null;
    if (!name || !description) return;
    try {
      await api('/teams', {
        method: 'POST',
        body: { name, description, logo_url: logoUrl },
      });
      loadTeams();
      e.target.reset();
    } catch (err) {
      alert(err.message);
    }
  };

  const onDeleteTeam = async (teamId) => {
    if (!confirm('Delete this team and all its members?')) return;
    try {
      await api(`/teams/${teamId}`, { method: 'DELETE' });
      loadTeams();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>;
  if (error) return <div className="page"><div className="error">{error}</div></div>;

  return (
    <div className="page">
      <h1>Team Dashboard</h1>
      <p className="lead">
        {isPresident || isAdmin
          ? 'Manage all teams in the club.'
          : 'Manage your owned teams.'}
      </p>

      <section className="card">
        <h2>Create New Team</h2>
        <form onSubmit={onCreateTeam} className="form">
          <label>
            Team Name
            <input type="text" name="name" required maxLength={100} />
          </label>
          <label>
            Description
            <textarea name="description" required rows={3} />
          </label>
          <label>
            Logo URL (optional)
            <input type="url" name="logoUrl" placeholder="https://example.com/logo.png" />
          </label>
          <button type="submit" className="btn-primary">Create Team</button>
        </form>
      </section>

      <section className="card">
        <h2>Your Teams</h2>
        {teams.length === 0 ? (
          <div className="info">No teams yet. Create one above!</div>
        ) : (
          <div className="teams-grid">
            {teams.map((team) => (
              <div key={team.id} className="team-dashboard-card card">
                {team.logo_url && <img src={team.logo_url} alt="" className="team-logo" />}
                <h3>{team.name}</h3>
                <p className="team-desc">{team.description}</p>
                <p className="team-owner">Lead: {team.owner_name}</p>
                <div className="team-actions">
                  <Link to={`/teams/${team.id}`} className="btn-secondary">View Public Page</Link>
                  <Link to={`/teams/${team.id}/manage`} className="btn-secondary">Manage Members</Link>
                  <button
                    className="btn-danger"
                    onClick={() => onDeleteTeam(team.id)}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}