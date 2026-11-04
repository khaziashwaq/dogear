import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dogear. is almost entirely per-viewer (feeds, shelves, permissions), so we use the
  // request-time rendering model rather than Cache Components. See docs/ARCHITECTURE.md.
  cacheComponents: false,
  poweredByHeader: false,
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
