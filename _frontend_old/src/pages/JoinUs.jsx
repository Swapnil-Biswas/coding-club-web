import { useState } from 'react';
import { api } from '../api.js';

// Public Contact / Join Us page
export function JoinUsPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null); // null, 'success', 'error'
  const [errorMsg, setErrorMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api('/join-requests', {
        method: 'POST',
        body: form,
      });
      setStatus('success');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Contact / Join Us</h1>
      <p className="lead">
        Want to join the club or have a question? Fill out the form below.
        We'll get back to you soon.
      </p>

      {status === 'success' && (
        <div className="card info">
          <strong>Thanks!</strong> Your message has been sent. We'll review it and get back to you.
        </div>
      )}

      <section className="card">
        <form onSubmit={onSubmit} className="form">
          <label>
            Name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
              disabled={submitting}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={submitting}
            />
          </label>

          <label>
            Message
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={6}
              disabled={submitting}
            />
          </label>

          {errorMsg && <div className="error">{errorMsg}</div>}

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Other ways to reach us</h3>
        <ul>
          <li>Email: <a href="mailto:club@example.edu">club@example.edu</a></li>
          <li>Instagram: <a href="#" target="_blank" rel="noopener">@codingclub</a></li>
          <li>Discord: <a href="#" target="_blank" rel="noopener">Join our server</a></li>
        </ul>
      </section>
    </div>
  );
}