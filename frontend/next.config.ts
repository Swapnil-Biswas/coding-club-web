import type { NextConfig } from "next";

// In dev the browser is pointed at same-origin /api/backend/* URLs (see
// app/lib/config.ts). These rewrites forward them to the Express backend,
// so the session cookie is same-origin and CORS never gets involved.
const BACKEND = process.env.BACKEND_URL || "http://localhost:3001";

const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSources = ["'self'", "'unsafe-inline'"];
if (isDevelopment) scriptSources.push("'unsafe-eval'");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: ws: wss:",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Allow the Cloudflare tunnel domain to load Next.js dev chunks (JS/CSS).
  // Without this, Next.js 16 blocks all /_next/static/* requests from external origins.
  allowedDevOrigins: [
    'bmsitcodingclub.space',
    'www.bmsitcodingclub.space',
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/recruitments", destination: "/recruitment", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/backend/:path*", destination: `${BACKEND}/:path*` },
    ];
  },
};

export default nextConfig;
