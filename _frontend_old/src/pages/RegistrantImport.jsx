import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Registrant management page for core_head+ users: import CSV, list registrants, export attendance CSV.
export function RegistrantImport() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEventId = searchParams.get('eventId');

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsErr, setEventsErr] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId ? Number(initialEventId) : null);

  const [csvFile, setCsvFile] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [importErr, setImportErr] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  const [registrants, setRegistrants] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regErr, setRegErr] = useState(null);

  // Load published events for the dropdown
  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const data = await api('/events?status=published');
        setEvents(data.events || []);
      } catch (err) {
        setEventsErr(err.message);
      } finally {
        setEventsLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Load registrants when event changes
  useEffect(() => {
    if (!selectedEventId) {
      setRegistrants([]);
      return;
    }
    const loadRegistrants = async () => {
      setRegLoading(true);
      setRegErr(null);
      try {
        const data = await api(`/events/${selectedEventId}/registrants`);
        setRegistrants(data.registrants || []);
      } catch (err) {
        setRegErr(err.message);
      } finally {
        setRegLoading(false);
      }
    };
    loadRegistrants();
  }, [selectedEventId]);

  const onImport = async (e) => {
    e.preventDefault();
    if (!selectedEventId) {
      setImportErr('Select an event first.');
      return;
    }
    if (!csvFile) {
      setImportErr('Choose a CSV file.');
      return;
    }
    setImportErr(null);
    setImportMsg(null);
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append('csv', csvFile);
      const data = await api(`/events/${selectedEventId}/registrants/import`, {
        method: 'POST',
        body: fd,
        isForm: true,
      });
      setImportMsg(`✓ Created: ${data.created}, Skipped (duplicates): ${data.skipped}, Errors: ${data.errors}, Total rows: ${data.total}`);
      setCsvFile(null);
      // Refresh registrant list
      const refreshed = await api(`/events/${selectedEventId}/registrants`);
      setRegistrants(refreshed.registrants || []);
    } catch (err) {
      setImportErr(err.message);
    } finally {
      setImportBusy(false);
    }
  };

  const onExport = async () => {
    if (!selectedEventId) return;
    try {
      // Use fetch directly for file download
      const res = await fetch(`/events/${selectedEventId}/attendance/export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `attendance-${selectedEventId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setImportErr('Export failed: ' + err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="page">
      <h1>Registrant Management</h1>

      <section className="card">
        <h2>Event</h2>
        {eventsLoading && <div className="loading">Loading events…</div>}
        {eventsErr && <div className="error">{eventsErr}</div>}
        {!eventsLoading && events.length === 0 && <div className="info">No published events available.</div>}
        {!eventsLoading && events.length > 0 && (
          <label>
            Select event
            <select
              value={selectedEventId || ''}
              onChange={(e) => {
                setSelectedEventId(Number(e.target.value));
                setSearchParams({ eventId: e.target.value });
              }}
            >
              <option value="">— Select an event —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {new Date(e.start_datetime).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selectedEventId && (
        <>
          <section className="card">
            <h2>Import Registrants (CSV)</h2>
            <p className="hint">
              Expected columns: Name / Email / Team (Team is optional).
              Headers can be: Name, Full Name, Student Name; Email, Email Address; Team, Team Name.
              Duplicate emails for the same event are skipped automatically.
            </p>
            <form onSubmit={onImport} className="form">
              <label>
                CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  disabled={importBusy}
                  required
                />
              </label>
              <button type="submit" disabled={importBusy || !csvFile}>
                {importBusy ? 'Importing…' : 'Import'}
              </button>
            </form>
            {importErr && <div className="error">{importErr}</div>}
            {importMsg && <div className="info">{importMsg}</div>}
          </section>

          <section className="card">
            <div className="section-header">
              <h2>Registrants</h2>
              <button onClick={onExport} disabled={regLoading} className="btn-secondary">
                Export Attendance CSV
              </button>
            </div>
            {regLoading && <div className="loading">Loading…</div>}
            {regErr && <div className="error">{regErr}</div>}
            {!regLoading && registrants.length === 0 && <div className="info">No registrants yet.</div>}
            {!regLoading && registrants.length > 0 && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Team</th>
                      <th>User Linked</th>
                      <th>Status</th>
                      <th>Checked In At</th>
                      <th>Checked In By</th>
                      <th>QR Token</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrants.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.email}</td>
                        <td>{r.team_name}</td>
                        <td>{r.user_name ? `${r.user_name} (${r.user_email})` : '—'}</td>
                        <td>
                          {r.checked_in ? (
                            <span className="badge badge-ok">Checked In</span>
                          ) : (
                            <span className="badge badge-muted">Absent</span>
                          )}
                        </td>
                        <td>{r.checked_in_at || '—'}</td>
                        <td>{r.checked_in_by_name || '—'}</td>
                        <td className="qr-token">{r.qr_code_token}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}