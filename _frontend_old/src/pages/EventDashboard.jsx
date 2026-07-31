import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Management dashboard. Renders the row of action buttons appropriate to the
// viewer's role:
//   core:           Create, Edit, Archive
//   core_head/admin: + Publish Draft, Force Complete
//
// The backend enforces all of these — buttons are UX, not security.
export function EventDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const isPublisher = user && ['core_head', 'admin'].includes(user.role);

  const load = async () => {
    try {
      const data = await api('/events');
      setEvents(data.events);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const patch = async (id, body) => {
    setBusyId(id);
    setError(null);
    try {
      await api(`/events/${id}`, { method: 'PATCH', body });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!confirm('Archive (delete) this event? This cannot be undone.')) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <h1>Event management</h1>
      {error && <div className="error">{error}</div>}
      <p>
        <Link to="/events/new" className="btn-primary">Create Event</Link>
      </p>
      {events.length === 0 ? (
        <p className="muted">No events yet.</p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>When</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link to={`/events/${e.id}`}>{e.title}</Link>
                </td>
                <td><span className={`status-badge ${e.status}`}>{e.status}</span></td>
                <td><span className={`visibility-badge ${e.visibility}`}>{e.visibility}</span></td>
                <td className="muted">
                  {new Date(e.start_datetime).toLocaleDateString()}
                </td>
                <td className="actions">
                  <button onClick={() => navigate(`/events/${e.id}/edit`)}>Edit</button>{' '}
                  {isPublisher && e.status === 'draft' && (
                    <button
                      disabled={busyId === e.id || !e.unstop_link}
                      onClick={() => patch(e.id, { status: 'published' })}
                      title={!e.unstop_link ? 'Unstop link required to publish' : 'Publish'}
                    >
                      Publish Draft
                    </button>
                  )}{' '}
                  {isPublisher && e.status !== 'completed' && (
                    <button
                      disabled={busyId === e.id}
                      onClick={() => patch(e.id, { status: 'completed' })}
                    >
                      Force Complete
                    </button>
                  )}{' '}
                  <button
                    disabled={busyId === e.id}
                    onClick={() => remove(e.id)}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}