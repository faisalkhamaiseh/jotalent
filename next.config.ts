import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Next.js streams pages with inline scripts. Allowing only nonce'd scripts
// would force every page to render per request, so inline scripts stay
// allowed; everything else is locked to our own origin: no third-party
// script hosts, no plugins, no framing, no <base> hijack, no off-site form posts.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera and microphone stay available to our own origin for in-platform calls.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
  },
  // Browsers ignore HSTS over plain HTTP, so this is inert on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // `next dev` only serves its scripts to the host it was opened on. Allowing
  // the loopback address too means http://127.0.0.1:3000 works like localhost,
  // which is handy for being signed in as two people at once (cookies are per host).
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // The signed-in area is rendered per user by design. Only check instant
    // navigation where a segment opts in, instead of warning on every page.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    // next-intl finds its request config through this alias. It is the one
    // thing `next-intl/plugin` would set up for us; the plugin is not used
    // because it loads @swc/core at startup, and that native binary refuses
    // to run where %LOCALAPPDATA% is writable by another Windows principal
    // (as it is on machines with a sandboxed desktop app installed).
    // Must stay a relative, forward-slash path.
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
