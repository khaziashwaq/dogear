import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dogear. is almost entirely per-viewer (feeds, shelves, permissions), so we use the
  // request-time rendering model rather than Cache Components. See docs/ARCHITECTURE.md.
  cacheComponents: false,
  poweredByHeader: false,
  // Headers for every response; the Content-Security-Policy (per-request nonce) is set in src/proxy.ts.
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
        : []),
    ];
    return [{ source: "/:path*", headers: security }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
