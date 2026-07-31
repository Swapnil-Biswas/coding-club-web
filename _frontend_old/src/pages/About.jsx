import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export function AboutPage() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const data = await api('/about');
      setContent(data.about?.content || '');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = user && ['core_head', 'admin'].includes(user.role);

  const onEdit = () => {
    setEditContent(content);
    setEditing(true);
  };

  const onSave = async () => {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await api('/about', { method: 'PATCH', body: { content: editContent } });
      setContent(editContent);
      setEditing(false);
      setMsg('Saved.');
    } catch (err) {
      setErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setEditing(false);
    setEditContent(content);
  };

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>;

  return (
    <div className="page narrow">
      <h1>About Us</h1>

      {msg && <div className="info">{msg}</div>}
      {err && <div className="error">{err}</div>}

      {editing ? (
        <section className="card">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={20}
            className="form textarea"
          />
          <div className="inline-form">
            <button onClick={onSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel} disabled={saving} className="btn-secondary">
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <section className="card about-content">
          <div
            dangerouslySetInnerHTML={{
              __html: content || '<p class="muted">No content yet. Click Edit to add some.</p>',
            }}
          />
        </section>
      )}

      {canEdit && !editing && (
        <div className="inline-form">
          <button onClick={onEdit} className="btn-secondary">Edit</button>
        </div>
      )}
    </div>
  );
}