import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Jangan biarkan Next menulis ke AGENTS.md (dikelola manual).
  agentRules: false,
  // forbidden() untuk 403 RBAC (requireAdmin, AC-22.2).
  experimental: { authInterrupts: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
