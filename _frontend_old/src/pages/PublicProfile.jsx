import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

// Public Profile page - only shows Core, Core Head, President, Admin
export function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      const data = await api(`/teams/users/${id}/teams`);
      setTeams(data.teams || []);
      // We also need basic user info. The /users/:id endpoint doesn't exist publicly,
      // so we'll derive a minimal profile from the team memberships or use /auth/me only for self.
      // For the public profile, we use a dedicated endpoint: /users/:id (public for core+ users)
      const user = await api(`/users/${id}`);
      if (!user.user) {
        setNotFound(true);
      } else if (!['core', 'core_head', 'admin'].includes(user.user.role)) {
        // Spec: only Core/Core Head/President/Admin can be publicly visible.
        setNotFound(true);
      } else {
        setProfile(user.user);
      }
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>;
  if (notFound) return (
    <div className="page">
      <h1>Profile not found</h1>
      <p>This profile does not exist or is not publicly visible.</p>
      <Link to="/" className="btn-primary">Back to home</Link>
    </div>
  );
  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!profile) return null;

  return (
    <div className="page narrow">
      <div className="profile-header card">
        {profile.profile_photo_url && (
          <img src={profile.profile_photo_url} alt="" className="profile-photo-large" />
        )}
        <h1>{profile.name}</h1>
        {profile.club_title && <div className="club-title">{profile.club_title}</div>}
        <div className="role-badge">{profile.role}</div>
      </div>

      <section className="card">
        <h2>Teams</h2>
        {teams.length === 0 ? (
          <div className="info">Not a member of any team.</div>
        ) : (
          <ul className="team-membership-list">
            {teams.map((t) => (
              <li key={t.id}>
                <Link to={`/teams`}>{t.name}</Link>
                {t.designation && <span className="designation"> — {t.designation}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}