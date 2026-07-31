import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Combined create + edit page. `id` in the URL means edit; absence means new.
// All permission checks are on the server — we just gate by route in App.jsx
// so a member can't even see the form. The server still gets the last word.
export function EventEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const isPublisher = user && ['core_head', 'admin'].includes(user.role);

  const [form, setForm] = useState({
    title: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    venue: '',
    category: '',
    visibility: 'public',
    unstop_link: '',
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    api(`/events/${id}`)
      .then((data) => {
        const e = data.event;
        setForm({
          title: e.title || '',
          description: e.description || '',
          // datetime-local needs the right format: YYYY-MM-DDTHH:MM
          start_datetime: toLocalInput(e.start_datetime),
          end_datetime: toLocalInput(e.end_datetime),
          venue: e.venue || '',
          category: e.category || '',
          visibility: e.visibility || 'public',
          unstop_link: e.unstop_link || '',
        });
        setLoadedId(Number(id));
      })
      .catch((err) => setError(err.message));
  }, [id, isEdit]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // The backend expects ISO strings; datetime-local gives us a local-time
      // string with no zone, so convert to ISO via Date.
      const payload = toIsoPayload(form);
      let saved;
      if (isEdit) {
        const res = await api(`/events/${id}`, { method: 'PATCH', body: payload });
        saved = res.event;
      } else {
        const res = await api('/events', { method: 'POST', body: payload });
        saved = res.event;
      }

      // Banner upload is a separate request — only if a file was picked.
      if (bannerFile) {
        const fd = new FormData();
        fd.append('banner', bannerFile);
        await api(`/events/${saved.id}/banner`, { method: 'POST', body: fd, isForm: true });
      }

      navigate(`/events/${saved.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page editor-form-page">
      <h1>{isEdit ? 'Edit event' : 'Create event'}</h1>
      {isEdit && !loadedId && <p className="muted">Loading…</p>}
      <form onSubmit={onSubmit} className="form editor-form">
        <label>
          Title
          <input value={form.title} onChange={set('title')} required maxLength={200} />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={5}
            maxLength={5000}
          />
        </label>
        <div className="form-row">
          <label>
            Start
            <input
              type="datetime-local"
              value={form.start_datetime}
              onChange={set('start_datetime')}
              required
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              value={form.end_datetime}
              onChange={set('end_datetime')}
              required
            />
          </label>
        </div>
        <label>
          Venue
          <input value={form.venue} onChange={set('venue')} maxLength={200} />
        </label>
        <label>
          Category
          <input value={form.category} onChange={set('category')} maxLength={100} />
        </label>
        <label>
          Visibility
          <select value={form.visibility} onChange={set('visibility')}>
            <option value="public">Public</option>
            <option value="member_only">Members only</option>
          </select>
        </label>
        <label>
          Unstop link
          <input
            type="url"
            value={form.unstop_link}
            onChange={set('unstop_link')}
            placeholder="https://unstop.com/..."
          />
          {!isPublisher && (
            <span className="muted">
              Only Core Head or Admin can publish. Without an Unstop link, this
              event can stay as a draft.
            </span>
          )}
        </label>
        <label>
          Banner image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        </button>
      </form>
      <p className="muted">
        <Link to="/manage/events">← Back to dashboard</Link>
      </p>
    </div>
  );
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoPayload(form) {
  return {
    title: form.title,
    description: form.description,
    start_datetime: form.start_datetime ? new Date(form.start_datetime).toISOString() : undefined,
    end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : undefined,
    venue: form.venue,
    category: form.category,
    visibility: form.visibility,
    unstop_link: form.unstop_link || null,
  };
}