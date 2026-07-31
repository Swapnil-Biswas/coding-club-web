import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Email verification. The 6-digit code is logged to the backend console —
// copy it from there and paste it in. After verification we drop them on
// the login page so they sign in fresh.
export function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!email) setError('Missing email — start from the signup page.');
  }, [email]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/verify-email', { method: 'POST', body: { email, code } });
      await refresh();
      navigate('/login', { state: { email, justVerified: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Verify your email</h1>
      <p className="muted">
        A 6-digit code was sent to your email. In dev mode the code is printed
        to the backend console.
      </p>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Verification code
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
      </form>
      <p className="muted">
        Didn't get one? <Link to="/signup">Sign up again</Link>.
      </p>
    </div>
  );
}
