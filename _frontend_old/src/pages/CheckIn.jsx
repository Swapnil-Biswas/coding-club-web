import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Check-in page for core+ users: select an event, scan a QR token, search for a registrant manually, or check one in by ID.
export function CheckIn() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialEventId = searchParams.get('eventId');

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsErr, setEventsErr] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId ? Number(initialEventId) : null);

  // QR scan state
  const [qrToken, setQrToken] = useState('');
  const [scanMsg, setScanMsg] = useState(null);
  const [scanErr, setScanErr] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  // Manual search state
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);

  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const data = await api('/events');
        setEvents(data.events || []);
      } catch (err) {
        setEventsErr(err.message);
      } finally {
        setEventsLoading(false);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  // Run search automatically when searchQ changes (debounced via small timeout).
  useEffect(() => {
    if (!selectedEventId || !searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchBusy(true);
    const t = setTimeout(async () => {
      try {
        const data = await api(`/events/${selectedEventId}/checkin/manual?q=${encodeURIComponent(searchQ.trim())}`);
        setSearchResults(data.registrants || []);
      } catch (err) {
        setSearchErr(err.message);
      } finally {
        setSearchBusy(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQ, selectedEventId]);

  const onScanSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEventId) {
      setScanErr('Select an event first.');
      return;
    }
    if (!qrToken.trim()) {
      setScanErr('Enter a QR token.');
      return;
    }
    setScanErr(null);
    setScanMsg(null);
    setScanBusy(true);
    try {
      const data = await api(`/events/${selectedEventId}/checkin`, {
        method: 'POST',
        body: { qr_code_token: qrToken.trim() },
      });
      if (data.alreadyCheckedIn) {
        setScanMsg(`⚠ ${data.message}`);
      } else {
        setScanMsg(`✓ ${data.message}`);
      }
      setLastScan({ token: qrToken.trim(), at: new Date(), data });
      setQrToken('');
    } catch (err) {
      setScanErr(err.message);
    } finally {
      setScanBusy(false);
    }
  };

  const onManualCheckin = async (registrantId) => {
    if (!selectedEventId) return;
    setScanErr(null);
    setScanMsg(null);
    try {
      const data = await api(`/events/${selectedEventId}/checkin/manual`, {
        method: 'POST',
        body: { registrant_id: registrantId },
      });
      if (data.alreadyCheckedIn) {
        setScanMsg(`⚠ ${data.message}`);
      } else {
        setScanMsg(`✓ ${data.message}`);
      }
      // Refresh search results
      if (searchQ.trim()) {
        const refreshed = await api(`/events/${selectedEventId}/checkin/manual?q=${encodeURIComponent(searchQ.trim())}`);
        setSearchResults(refreshed.registrants || []);
      }
    } catch (err) {
      setScanErr(err.message);
    }
  };

  if (!user) return null;
  const eventObj = events.find((e) => e.id === selectedEventId);

  return (
    <div className="page">
      <h1>Check-In</h1>

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
              onChange={(e) => setSelectedEventId(Number(e.target.value))}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {new Date(e.start_datetime).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="card">
        <h2>Scan QR code</h2>
        <form onSubmit={onScanSubmit} className="form inline-form">
          <input
            type="text"
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
            placeholder="Paste QR token"
            disabled={scanBusy || !selectedEventId}
          />
          <button type="submit" disabled={scanBusy || !selectedEventId}>
            {scanBusy ? 'Checking…' : 'Check in'}
          </button>
        </form>
        {scanErr && <div className="error">{scanErr}</div>}
        {scanMsg && <div className="info">{scanMsg}</div>}
        {lastScan && (
          <div className="scan-history">
            Last scan at {lastScan.at.toLocaleTimeString()}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Manual check-in</h2>
        <p className="hint">Search by name, email, or team name.</p>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Type to search…"
          disabled={!selectedEventId}
        />
        {searchBusy && <div className="loading">Searching…</div>}
        {searchResults.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Team</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.team_name}</td>
                  <td>
                    {r.checked_in ? (
                      <span className="badge badge-ok">Checked in {r.checked_in_at}</span>
                    ) : (
                      <span className="badge badge-muted">Not checked in</span>
                    )}
                  </td>
                  <td>
                    {!r.checked_in && (
                      <button onClick={() => onManualCheckin(r.id)} disabled={!selectedEventId}>
                        Check in
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!searchBusy && searchQ.trim() && searchResults.length === 0 && (
          <div className="info">No matches.</div>
        )}
      </section>

      {eventObj && (
        <div className="info-link">
          Need to manage registrants? <a href={`/events/${eventObj.id}/registrants`}>Open registrant list</a>
        </div>
      )}
    </div>
  );
}
