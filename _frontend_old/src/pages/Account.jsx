import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Account settings: read-only name/email, profile photo upload, password change.
// Backend enforces "current password required" for password change — we just
// surface whatever error it gives back.
export function Account() {
  const { user, setUser, refresh } = useAuth();
  const [photoFile, setPhotoFile] = useState(null);
  const [photoMsg, setPhotoMsg] = useState(null);
  const [photoErr, setPhotoErr] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  // My Events (attended)
  const [attendedEvents, setAttendedEvents] = useState([]);
  const [attendedLoading, setAttendedLoading] = useState(true);
  const [attendedErr, setAttendedErr] = useState(null);

  useEffect(() => {
    const loadAttended = async () => {
      setAttendedLoading(true);
      try {
        const data = await api('/users/me/attended-events');
        setAttendedEvents(data.events || []);
      } catch (err) {
        setAttendedErr(err.message);
      } finally {
        setAttendedLoading(false);
      }
    };
    loadAttended();
  }, []);

  const onUpload = async (e) => {
    e.preventDefault();
    if (!photoFile) {
      setPhotoErr('Choose a file first.');
      return;
    }
    setPhotoErr(null);
    setPhotoMsg(null);
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);
      const res = await api('/users/me/photo', { method: 'POST', body: fd, isForm: true });
      setUser(res.user);
      setPhotoMsg('Photo updated.');
      setPhotoFile(null);
    } catch (err) {
      setPhotoErr(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const onChangePw = async (e) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    setPwBusy(true);
    try {
      await api('/users/me/password', {
        method: 'POST',
        body: { currentPassword: currentPw, newPassword: newPw },
      });
      setPwMsg('Password changed.');
      setCurrentPw('');
      setNewPw('');
      await refresh();
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="page narrow">
      <h1>Account</h1>

      <section className="card">
        <h2>Profile</h2>
        <div className="profile-row">
          <div className="profile-photo">
            {user.profile_photo_url ? (
              <img src={user.profile_photo_url} alt="" />
            ) : (
              <div className="photo-placeholder">No photo</div>
            )}
          </div>
          <dl className="profile-info">
            <dt>Name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd><span className="role-badge">{user.role}</span></dd>
          </dl>
        </div>
        <form onSubmit={onUpload} className="form inline-form">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
          <button type="submit" disabled={photoBusy}>{photoBusy ? 'Uploading…' : 'Upload photo'}</button>
          {photoErr && <div className="error">{photoErr}</div>}
          {photoMsg && <div className="info">{photoMsg}</div>}
        </form>
      </section>

      <section className="card">
        <h2>Change password</h2>
        <form onSubmit={onChangePw} className="form">
          <label>
            Current password
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          {pwErr && <div className="error">{pwErr}</div>}
          {pwMsg && <div className="info">{pwMsg}</div>}
          <button type="submit" disabled={pwBusy}>{pwBusy ? 'Saving…' : 'Change password'}</button>
        </form>
      </section>

      <section className="card">
        <h2>My Events</h2>
        {attendedLoading && <div className="loading">Loading…</div>}
        {attendedErr && <div className="error">Failed to load events: {attendedErr}</div>}
        {!attendedLoading && !attendedErr && attendedEvents.length === 0 && (
          <div className="info">You haven't checked in to any events yet.</div>
        )}
        {!attendedLoading && !attendedErr && attendedEvents.length > 0 && (
          <ul className="event-list">
            {attendedEvents.map((e) => (
              <li key={e.id} className="event-item">
                <div className="event-main">
                  <strong>{e.title}</strong>
                  <span className="event-meta">
                    {new Date(e.start_datetime).toLocaleDateString()} • {e.venue || 'No venue'}
                  </span>
                </div>
                <div className="event-checkin">
                  Checked in: {new Date(e.checked_in_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
