// Single fetch wrapper for the Express backend.
//
// Two ways to reach the backend (see app/lib/config.ts):
//   - Proxy (default in dev): browser calls same-origin /api/backend/*, which
//     Next.js rewrites to the backend. The session cookie is first-party, so
//     CORS and cross-port cookie issues simply don't exist.
//   - Direct: NEXT_PUBLIC_API_URL is set, so the browser calls the backend
//     origin over CORS (used if the API lives on its own origin in prod).
//
// Either way `credentials: "include"` keeps the session cookie on the request.
// All backend errors come back shaped `{ error: string }`; we surface that
// message and preserve the HTTP status for 401/403 handling.

import { API_URL, USE_PROXY } from "./config";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/** The base URL for data calls. Empty/relative when proxying (same-origin). */
export const API_BASE: string = USE_PROXY ? "/api/backend" : API_URL;

// Where /uploads/... assets live. Same-origin when proxied, else the API origin.
const ASSET_BASE: string = USE_PROXY ? "/api/backend" : API_URL;

interface ApiOptions {
  method?: string;
  body?: unknown;
  /** When true, `body` is a FormData and we let the browser set Content-Type. */
  isForm?: boolean;
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, isForm }: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (isForm) {
      payload = body as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: "include",
      headers,
      body: payload,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Is the backend running?",
      0,
      null,
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      (data &&
        typeof data === "object" &&
        ((data as { error?: string; message?: string }).error ||
          (data as { message?: string }).message)) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(msg), res.status, data);
  }
  return data as T;
}

/**
 * Trigger a browser download for a file endpoint (CSV export). We can't use
 * `api()` because it parses JSON; we need the raw blob + filename header.
 * The session cookie rides along via credentials: include.
 */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(API_BASE + path, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg =
      (data && (data as { error?: string }).error) || `Download failed (${res.status})`;
    throw new ApiError(String(msg), res.status, data);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Resolve a backend-returned asset path (e.g. `/uploads/x.png`) to a usable URL. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return ASSET_BASE + (path.startsWith("/") ? path : "/" + path);
}
