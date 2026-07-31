import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Public landing. Logged-out users must be able to see this.
export function Home() {
  const { user } = useAuth();
  return (
    <div className="page">
      <h1>Coding Club</h1>
      <p className="lead">
        Welcome to the club platform. Explore our teams, gallery, sponsors, and more.
      </p>
      <div className="home-links">
        <Link to="/teams" className="home-card">
          <h3>Teams</h3>
          <p>Meet our technical, design, marketing, and competitive programming teams.</p>
        </Link>
        <Link to="/gallery" className="home-card">
          <h3>Gallery</h3>
          <p>Photos from our events, workshops, and hackathons.</p>
        </Link>
        <Link to="/sponsors" className="home-card">
          <h3>Sponsors</h3>
          <p>Our generous sponsors who make everything possible.</p>
        </Link>
        <Link to="/about" className="home-card">
          <h3>About Us</h3>
          <p>Learn about our mission, history, and leadership.</p>
        </Link>
        <Link to="/join" className="home-card">
          <h3>Join Us</h3>
          <p>Want to join or have questions? Get in touch.</p>
        </Link>
      </div>
      {user ? (
        <p style={{ marginTop: '2rem' }}>
          You're logged in as <strong>{user.name}</strong> with role{' '}
          <span className="role-badge">
            {user.club_title === 'President' ? 'President' : user.role}
          </span>.
        </p>
      ) : (
        <p style={{ marginTop: '2rem' }}>
          <Link to="/signup" className="btn-primary">Create an account</Link>{' '}
          <Link to="/login">or log in</Link>.
        </p>
      )}
    </div>
  );
}