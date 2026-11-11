import type { NextConfig } from "next";
import { robotsHeaderRules } from "./src/lib/seo";
import { appOrigin, staticSecurityHeaders } from "./src/lib/security/headers";
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

// P25: Server Actions hanya dari host APP_URL sendiri (selain cek Origin=Host bawaan Next).
// Tanpa wildcard; APP_URL tidak valid → daftar kosong (hanya same-host).
const appHost = appOrigin(process.env.APP_URL)?.host;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Jangan biarkan Next menulis ke AGENTS.md (dikelola manual).
  agentRules: false,
  // forbidden() untuk 403 RBAC (requireAdmin, AC-22.2).
  experimental: {
    authInterrupts: true,
    serverActions: { allowedOrigins: appHost ? [appHost] : [] },
  },
  // PDF kuitansi (P19): @react-pdf/renderer dimuat dari node_modules (tidak dibundel) dan font
  // lokal ikut di-trace ke fungsi serverless yang merender PDF.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/donor/transactions/[code]/pdf": ["./src/lib/pdf/fonts/*.ttf", "./src/lib/pdf/brand/*.png"],
    "/api/transactions/[code]/receipt": ["./src/lib/pdf/fonts/*.ttf", "./src/lib/pdf/brand/*.png"],
    "/api/jobs/notify": ["./src/lib/pdf/fonts/*.ttf", "./src/lib/pdf/brand/*.png"],
  },
  poweredByHeader: false,
  // X-Robots-Tag: noindex untuk area privat; seluruh situs di luar production (P24).
  // P25: header keamanan statis untuk SEMUA respons (CSP ber-nonce di src/proxy.ts).
  async headers() {
    const env = { APP_ENV: process.env.APP_ENV, APP_URL: process.env.APP_URL };
    return [{ source: "/:path*", headers: staticSecurityHeaders(env) }, ...robotsHeaderRules()];
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
