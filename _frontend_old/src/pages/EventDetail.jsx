import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setEvent(null);
    setError(null);
    api(`/events/${id}`)
      .then((data) => setEvent(data.event))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="page narrow">
        <h1>Event</h1>
        <div className="error">{error}</div>
        <p><Link to="/events">← Back to events</Link></p>
      </div>
    );
  }
  if (!event) return <div className="page-msg">Loading…</div>;

  const isManager = user && ['core', 'core_head', 'admin'].includes(user.role);

  return (
    <div className="page event-detail">
      {event.banner_image_url ? (
        <img src={event.banner_image_url} alt="" className="event-detail-banner" />
      ) : (
        <div className="event-detail-banner-placeholder">No banner</div>
      )}
      <div className="event-header">
        <h1 style={{ margin: 0 }}>{event.title}</h1>
        <span className={`event-status ${event.status}`}>{event.status}</span>
        <span className="event-visibility">
          {event.visibility === 'member_only' ? 'Members only' : 'Public visibility'}
        </span>
        {event.category && <span className="event-visibility">{event.category}</span>}
      </div>
      <div className="event-meta-row">
        <span>📅 {new Date(event.start_datetime).toLocaleString()}</span>
        <span>⏱ {new Date(event.end_datetime).toLocaleString()}</span>
        <span>📍 {event.venue || 'TBA'}</span>
      </div>
      {event.description && (
        <div className="event-description">{event.description}</div>
      )}
      {event.unstop_link && (
        <p>
          <a
            href={event.unstop_link}
            target="_blank"
            rel="noopener noreferrer"
            className="event-unstop"
          >
            Register on Unstop ↗
          </a>
        </p>
      )}
      {isManager && (
        <p>
          <Link to={`/events/${event.id}/edit`} className="nav-link">Edit event</Link>
        </p>
      )}
      {user && ['core_head', 'admin'].includes(user.role) && (
        <p>
          <Link to={`/events/${event.id}/registrants`} className="nav-link">Manage Registrants</Link>
        </p>
      )}
      <p><Link to="/events">← Back to events</Link></p>
    </div>
  );
}