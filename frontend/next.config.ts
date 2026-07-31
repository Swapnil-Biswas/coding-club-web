import type { NextConfig } from "next";

// In dev the browser is pointed at same-origin /api/backend/* URLs (see
// app/lib/config.ts). These rewrites forward them to the Express backend,
// so the session cookie is same-origin and CORS never gets involved.
const BACKEND = process.env.BACKEND_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/backend/:path*", destination: `${BACKEND}/:path*` },
    ];
  },
};

export default nextConfig;
