import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  API_CSP,
  buildCsp,
  createNonce,
  hstsValue,
  isTokenBearingPath,
  REACT_SHELL_INLINE_SCRIPTS,
  REACT_SHELL_SCRIPT_HASHES,
  staticSecurityHeaders,
} from "@/lib/security/headers";

// P25 (T-45): kebijakan header keamanan (security.md §5).

const PROD = { APP_ENV: "production", APP_URL: "https://tebarkebaikan.id", NODE_ENV: "production", blobHost: "abc123def.public.blob.vercel-storage.com" };

function directives(csp: string) {
  return Object.fromEntries(csp.split("; ").map((d) => { const [k, ...v] = d.split(" "); return [k, v.join(" ")]; }));
}

describe("CSP", () => {
  it("production: nonce + self + hash, tanpa unsafe-inline/unsafe-eval untuk script", () => {
    const d = directives(buildCsp("N0nce==", PROD));
    expect(d["script-src"]).toBe("'self' 'nonce-N0nce==' 'sha256-7mu4H06fwDCjmnxxr/xNHyuQC6pLTHr4M2E4jXw5WZs='");
    expect(d["script-src"]).not.toMatch(/unsafe/);
    expect(d["object-src"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["form-action"]).toBe("'self' https://accounts.google.com");
    expect(d["connect-src"]).toBe("'self'");
    expect(d["img-src"]).toBe("'self' data: blob: https://abc123def.public.blob.vercel-storage.com");
    expect(d).toHaveProperty("upgrade-insecure-requests");
  });

  it("tidak ada wildcard host di luar development; tanpa blob host → hanya self", () => {
    const csp = buildCsp("n", { ...PROD, blobHost: null });
    expect(csp).not.toContain("*");
    expect(directives(csp)["img-src"]).toBe("'self' data: blob:");
  });

  it("http localhost: tanpa upgrade-insecure-requests; next dev: unsafe-eval + ws", () => {
    const local = buildCsp("n", { APP_ENV: "development", APP_URL: "http://localhost:3100", NODE_ENV: "production" });
    expect(local).not.toContain("upgrade-insecure-requests");
    expect(local).not.toContain("unsafe-eval");
    const dev = directives(buildCsp("n", { APP_ENV: "development", APP_URL: "http://localhost:3000", NODE_ENV: "development" }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toBe("'self' ws: wss:");
  });

  it("hash script shell React cocok dengan string di react-dom yang dipakai Next", () => {
    // App Router merender dengan react-dom bawaan Next (next/dist/compiled), bukan paket root.
    const require = createRequire(import.meta.url);
    const nextDir = dirname(require.resolve("next/package.json"));
    const fizz = readFileSync(join(nextDir, "dist/compiled/react-dom/cjs/react-dom-server.edge.production.js"), "utf8");
    REACT_SHELL_INLINE_SCRIPTS.forEach((src, i) => {
      expect(fizz).toContain(JSON.stringify(src));
      const hash = createHash("sha256").update(src).digest("base64");
      expect(REACT_SHELL_SCRIPT_HASHES[i]).toBe(`'sha256-${hash}'`);
    });
  });

  it("nonce acak 128-bit, base64", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });

  it("API tidak memuat apa pun", () => {
    expect(API_CSP).toContain("default-src 'none'");
    expect(API_CSP).toContain("frame-ancestors 'none'");
  });
});

describe("header statis", () => {
  it("HSTS hanya production https", () => {
    expect(hstsValue(PROD)).toBe("max-age=31536000");
    expect(hstsValue({ ...PROD, APP_ENV: "preview" })).toBeNull();
    expect(hstsValue({ APP_ENV: "production", APP_URL: "http://localhost:3100" })).toBeNull();
  });

  it("XFO, nosniff, referrer, permissions", () => {
    const h = Object.fromEntries(staticSecurityHeaders(PROD).map((x) => [x.key, x.value]));
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(staticSecurityHeaders({ APP_ENV: "development" }).map((x) => x.key)).not.toContain("Strict-Transport-Security");
  });

  it("path ber-token → no-referrer", () => {
    expect(isTokenBearingPath("/transaksi/TK-1/instruksi")).toBe(true);
    expect(isTokenBearingPath("/donasi/masjid/pembayaran")).toBe(true);
    expect(isTokenBearingPath("/donasi/masjid")).toBe(false);
    expect(isTokenBearingPath("/campaign/masjid")).toBe(false);
  });
});
