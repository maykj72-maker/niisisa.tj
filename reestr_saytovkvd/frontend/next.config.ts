import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Proxy API and media through the web origin so the session cookie is first-party.
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "https://niisisa-api-production.up.railway.app").replace(/\/+$/, "");
    return [
      { source: "/api/:path*", destination: `${target}/api/:path*` },
      { source: "/media/:path*", destination: `${target}/media/:path*` },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
