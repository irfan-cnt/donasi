import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Jangan biarkan Next menulis ke AGENTS.md (dikelola manual).
  agentRules: false,
  // forbidden() untuk 403 RBAC (requireAdmin, AC-22.2).
  experimental: { authInterrupts: true },
  // PDF kuitansi (P19): @react-pdf/renderer dimuat dari node_modules (tidak dibundel) dan font
  // lokal ikut di-trace ke fungsi serverless yang merender PDF.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/donor/transactions/[code]/pdf": ["./src/lib/pdf/fonts/*.ttf"],
    "/api/transactions/[code]/receipt": ["./src/lib/pdf/fonts/*.ttf"],
    "/api/jobs/notify": ["./src/lib/pdf/fonts/*.ttf"],
  },
  // Gambar campaign/news dari Vercel Blob (OD-12).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
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
