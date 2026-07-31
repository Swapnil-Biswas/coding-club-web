import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// The signup form is intentionally a thin layer. The backend enforces the
// email domain — we just echo whatever error comes back so the user can fix it.
export function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await api('/auth/signup', {
        method: 'POST',
        body: { name, email, password },
      });
      setInfo(res.message || 'Account created. Check the backend console for the verification code.');
      // Bounce to the verify page, pre-filling the email.
      setTimeout(() => navigate('/verify', { state: { email } }), 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Sign up</h1>
      <p className="muted">
        You must use your college email. The domain check is enforced on the
        server — submitting the wrong domain will be rejected.
      </p>
      <form onSubmit={onSubmit} className="form">
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>.
      </p>
    </div>
  );
}
