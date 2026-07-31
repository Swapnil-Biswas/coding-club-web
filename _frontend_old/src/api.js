// Single fetch wrapper. credentials: 'include' is what makes the session
// cookie flow to the backend on every call. All errors come back as Error
// instances with the backend's error message attached.

const BASE = '';

export async function api(path, { method = 'GET', body, isForm } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData sets its own Content-Type
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
