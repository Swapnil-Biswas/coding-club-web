// How the frontend reaches the backend.
//
// Default: the Next.js dev server proxies API paths to the Express backend
// (see rewrites in next.config.ts). The browser makes SAME-ORIGIN requests to
// /api/backend/*, so the session cookie just works — no CORS, no cross-port
// cookie issues, on whatever port the dev server happens to run.
//
// To talk to the backend directly instead (e.g. production with a separate
// API origin), set NEXT_PUBLIC_API_URL=http://host:port in .env.local; the
// client will call that origin (with credentials) and skip the proxy.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
export const USE_PROXY = !API_URL;
