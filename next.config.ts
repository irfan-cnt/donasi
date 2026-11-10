import type { NextConfig } from "next";
import { blobStoreHost } from "./src/lib/storage/blob-host";

// M1 P21: hanya host store Blob proyek ini (dari BLOB_STORE_ID / token). Wildcard hanya di
// APP_ENV=development bila store belum diketahui; di luar itu tanpa remote host sama sekali.
const blobHost = blobStoreHost({
  BLOB_STORE_ID: process.env.BLOB_STORE_ID,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
});
const remotePatterns = blobHost
  ? [{ protocol: "https" as const, hostname: blobHost }]
  : (process.env.APP_ENV ?? "development") === "development"
    ? [{ protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com" }]
    : [];

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
  images: { remotePatterns },
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
