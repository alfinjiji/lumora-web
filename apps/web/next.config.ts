import type { NextConfig } from "next";
const backend = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
const config: NextConfig = {
  output: "standalone",
  experimental: { proxyClientMaxBodySize: "12mb" },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async rewrites() {
    return ["api/v1", "auth", "sanctum", "webhooks", "media"].map((p) => ({
      source: `/${p}/:path*`,
      destination: `${backend}/${p}/:path*`,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
