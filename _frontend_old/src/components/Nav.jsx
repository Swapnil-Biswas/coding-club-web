import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const MANAGERS = ['core', 'core_head', 'admin'];
const CORE_PLUS = ['core', 'core_head', 'admin'];
const CORE_HEAD_PLUS = ['core_head', 'admin'];

export function Nav() {
  const { user, logout, ready } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isTeamManager = user && (user.role === 'core_head' || user.role === 'admin');

  return (
    <header className="nav">
      <div className="nav-left">
        <Link to="/" className="nav-brand">Coding Club</Link>
        <Link to="/events" className="nav-link">Events</Link>
        <Link to="/teams" className="nav-link">Teams</Link>
        <Link to="/gallery" className="nav-link">Gallery</Link>
        <Link to="/sponsors" className="nav-link">Sponsors</Link>
        <Link to="/about" className="nav-link">About</Link>
        <Link to="/join" className="nav-link">Contact</Link>
        {user && MANAGERS.includes(user.role) && (
          <Link to="/manage/events" className="nav-link">Manage Events</Link>
        )}
        {user && CORE_PLUS.includes(user.role) && (
          <Link to="/checkin" className="nav-link">Check-In</Link>
        )}
        {user && CORE_HEAD_PLUS.includes(user.role) && (
          <Link to="/events/1/registrants" className="nav-link">Registrants</Link>
        )}
        {user && isTeamManager && (
          <Link to="/dashboard/teams" className="nav-link">Team Dashboard</Link>
        )}
        {user && (user.role === 'core' || user.role === 'core_head' || user.role === 'admin') && (
          <Link to="/members" className="nav-link">Members</Link>
        )}
      </div>
      <div className="nav-right">
        {ready && user ? (
          <>
            <Link to="/account" className="nav-link">
              {user.name}{' '}
              <span className="role-badge">
                {user.club_title === 'President' ? 'President' : user.role}
              </span>
            </Link>
            <button className="nav-link nav-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : ready ? (
          <>
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/signup" className="nav-link nav-cta">Sign up</Link>
          </>
        ) : null}
      </div>
    </header>
  );
}