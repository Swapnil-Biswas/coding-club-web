import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Public event list — visibility is enforced server-side. The page just renders
// what it gets back. Logged-out users see only published public events; members
// also see published member_only events; core/core_head/admin also see drafts.
export function EventList() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/events')
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="page-msg error">Failed to load events: {error}</div>;

  return (
    <div className="page">
      <h1>Events</h1>
      <p className="muted">
        Showing events visible to your role: <strong>{user?.role || 'public'}</strong>.
      </p>
      {user && ['core', 'core_head', 'admin'].includes(user.role) && (
        <Link to="/events/new" className="btn-primary" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          Create Event
        </Link>
      )}
      <div className="events-grid">
        {events.length === 0 ? (
          <p className="muted">No events found.</p>
        ) : (
          events.map((e) => (
            <Link key={e.id} to={`/events/${e.id}`} className="event-card">
              {e.banner_image_url ? (
                <img src={e.banner_image_url} alt="" className="event-banner" />
              ) : (
                <div className="event-banner-placeholder">No banner</div>
              )}
              <div className="event-body">
                <h3 className="event-title">{e.title}</h3>
                <p>
                  <span className={`event-status ${e.status}`}>{e.status}</span>
                </p>
                <p className="event-visibility">
                  {e.visibility === 'member_only' ? 'Members only' : 'Public'} · {e.venue || 'TBA'}
                </p>
                <p className="event-visibility">{formatDateRange(e.start_datetime, e.end_datetime)}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleString(undefined, opts)} – ${e.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}