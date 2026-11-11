import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { sha256 } from "@/lib/security/crypto";
import { adminPagePermission } from "@/lib/admin-auth/page-permissions";
import { API_CSP, buildCsp, createNonce, isTokenBearingPath } from "@/lib/security/headers";
import { blobStoreHost } from "@/lib/storage/blob-host";
import { readCampaignPreviewToken } from "@/lib/security/preview-token";
import { normalizeSlug } from "@/lib/slug";
import { isTransactionCode } from "@/lib/transaction-code";
import {
  donorTransactionAccess,
  previewCampaignExists,
  publicCampaignExists,
  publicNewsExists,
  adminSessionPermissions,
  transactionAccessExists,
  transactionTokenValid,
} from "@/server/queries/public-route-exists";
import { safeError } from "@/lib/safe-error";

// Lapisan pertama saja (optimistic): cek keberadaan cookie sesi. Validasi sesi sebenarnya
// ada di requireDonor()/requireAdmin() pada layout/halaman/action (security.md §3).
// Cookie donor & admin terpisah: cookie donor tidak pernah membuka /admin dan sebaliknya.
const DONOR_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];
const ADMIN_COOKIES = ["__Host-tk_admin", "tk_admin"];

function redirectTo(request: NextRequest, pathname: string, callback: boolean) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (callback) {
    url.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(url);
}

// Slug campaign case-insensitive → 301 ke slug kanonik huruf kecil (slug di DB selalu huruf
// kecil, CHECK campaigns_slug_check). Query string (mis. token pratinjau) dipertahankan.
function canonicalCampaignRedirect(request: NextRequest) {
  const match = /^\/campaign\/([^/]+)(\/.*)?$/.exec(request.nextUrl.pathname);
  if (!match) return null;
  const slug = match[1]!;
  const lower = slug.toLowerCase();
  if (lower === slug) return null;
  const url = request.nextUrl.clone();
  url.pathname = `/campaign/${lower}${match[2] ?? ""}`;
  return NextResponse.redirect(url, 301);
}

/**
 * P25 (L2): halaman admin tanpa permission → HTTP 403 sungguhan (rewrite ke /akses-ditolak)
 * sebelum streaming. Sesi tidak valid/langkah wajib → diteruskan (halaman me-redirect). Error DB
 * → fail-open ke halaman, yang tetap memanggil requireAdmin(permission) (UI 403).
 */
async function adminPermissionGate(request: NextRequest) {
  const required = adminPagePermission(request.nextUrl.pathname);
  if (!required) return NextResponse.next();
  const token = ADMIN_COOKIES.map((name) => request.cookies.get(name)?.value).find(Boolean) ?? "";
  try {
    const permissions = token ? await adminSessionPermissions(sha256(token)) : null;
    if (permissions && !permissions.includes(required)) {
      const url = request.nextUrl.clone();
      url.pathname = "/akses-ditolak";
      url.search = "";
      return NextResponse.rewrite(url, { status: 403 });
    }
  } catch (error) {
    logger.warn("cek permission admin gagal; fail-open", { error: safeError(error) });
  }
  return NextResponse.next();
}

/** Rewrite ke path tanpa route → halaman not-found Next dengan status 404 sungguhan. */
function notFoundResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/_tidak-ditemukan";
  url.search = "";
  return NextResponse.rewrite(url, { status: 404 });
}

// Draft/archived/slug salah → 404 sebelum streaming dimulai (AC-02.1, AC-03.1, AC-03.3).
async function campaignExistenceGate(request: NextRequest) {
  const match = /^\/campaign\/([^/]+)(?:\/(pratinjau|berita\/([^/]+)))?\/?$/.exec(
    request.nextUrl.pathname,
  );
  if (!match) return NextResponse.next();
  const slug = normalizeSlug(match[1]!);
  if (!slug) return notFoundResponse(request);
  try {
    let exists: boolean;
    if (match[2] === "pratinjau") {
      const token = request.nextUrl.searchParams.get("token") ?? "";
      const campaignId = token ? readCampaignPreviewToken(token) : null;
      exists = campaignId !== null && (await previewCampaignExists(slug, campaignId));
    } else if (match[3] !== undefined) {
      const newsSlug = normalizeSlug(match[3]);
      exists = newsSlug !== null && (await publicNewsExists(slug, newsSlug));
    } else {
      exists = await publicCampaignExists(slug);
    }
    return exists ? NextResponse.next() : notFoundResponse(request);
  } catch (error) {
    // Fail-open: halaman tetap memanggil notFound() sendiri (soft 404 + noindex).
    logger.warn("cek keberadaan campaign gagal; fail-open", { error: safeError(error) });
    return NextResponse.next();
  }
}

// Checkout & pembayaran (P08): slug draft/archived/tidak ada → 404; halaman pembayaran hanya
// dengan kode transaksi + access token sah (selain itu 404, tidak membocorkan keberadaan).
async function donationGate(request: NextRequest) {
  const match = /^\/donasi\/([^/]+)(\/pembayaran)?\/?$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  const slug = normalizeSlug(match[1]!);
  if (!slug || slug !== match[1]) return notFoundResponse(request);
  try {
    let exists: boolean;
    if (match[2]) {
      const code = request.nextUrl.searchParams.get("trx") ?? "";
      const token = request.nextUrl.searchParams.get("t") ?? "";
      exists =
        isTransactionCode(code) &&
        /^[A-Za-z0-9_-]{43}$/.test(token) &&
        (await transactionAccessExists(slug, code, sha256(token)));
    } else {
      exists = await publicCampaignExists(slug);
    }
    return exists ? NextResponse.next() : notFoundResponse(request);
  } catch (error) {
    // Fail-open: halaman memvalidasi ulang dan memanggil notFound() sendiri.
    logger.warn("cek rute donasi gagal; fail-open", { error: safeError(error) });
    return NextResponse.next();
  }
}

// Halaman transaksi /transaksi/[code]/* (instruksi P11, status P12): hanya dengan kode + access
// token sah (?t=), selain itu 404. Pengecualian: /transaksi/[code]/menunggu TANPA ?t= (target
// callback e-wallet Midtrans, yang sengaja tidak memuat token) → halaman generik tanpa data
// transaksi apa pun dan tanpa query DB (payment-architecture.md §3c).
async function transactionGate(request: NextRequest) {
  const match = /^\/transaksi\/([^/]+)(?:\/.*)?$/.exec(request.nextUrl.pathname);
  const waiting = /^\/transaksi\/[^/]+\/menunggu\/?$/.test(request.nextUrl.pathname);
  if (!match) return notFoundResponse(request);
  const code = match[1]!;
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (waiting && !request.nextUrl.searchParams.has("t")) {
    return isTransactionCode(code) ? NextResponse.next() : notFoundResponse(request);
  }
  try {
    const ok =
      isTransactionCode(code) &&
      /^[A-Za-z0-9_-]{43}$/.test(token) &&
      (await transactionTokenValid(code, sha256(token)));
    return ok ? NextResponse.next() : notFoundResponse(request);
  } catch (error) {
    logger.warn("cek rute transaksi gagal; fail-open", { error: safeError(error) });
    return NextResponse.next();
  }
}

// Host Blob dihitung sekali (env build/runtime; tidak memuat secret — hanya id store publik).
const BLOB_HOST = blobStoreHost({
  BLOB_STORE_ID: process.env.BLOB_STORE_ID,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
});

/**
 * P25 (T-45): CSP ber-nonce untuk setiap respons yang melewati proxy. Nonce juga diteruskan ke
 * request (header `Content-Security-Policy` + `x-nonce`) agar Next menempelkannya ke script
 * framework/inline saat render. Header statis lain (XFO, nosniff, HSTS, ...) di next.config.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const nonce = createNonce();
  const csp = isApi
    ? API_CSP
    : buildCsp(nonce, {
        APP_ENV: process.env.APP_ENV,
        APP_URL: process.env.APP_URL,
        NODE_ENV: process.env.NODE_ENV,
        blobHost: BLOB_HOST,
      });
  const response = isApi ? NextResponse.next() : await route(request);
  // Respons next/rewrite: teruskan header request yang diperbarui (setara
  // NextResponse.next({ request: { headers } })).
  if (!isApi && (response.headers.has("x-middleware-next") || response.headers.has("x-middleware-rewrite"))) {
    const forwarded = new Headers(request.headers);
    forwarded.set("x-nonce", nonce);
    forwarded.set("Content-Security-Policy", csp);
    const keys: string[] = [];
    for (const [key, value] of forwarded) {
      response.headers.set(`x-middleware-request-${key}`, value);
      keys.push(key);
    }
    response.headers.set("x-middleware-override-headers", keys.join(","));
  }
  response.headers.set("Content-Security-Policy", csp);
  if (isTokenBearingPath(pathname)) response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

const GATED = /^\/(campaign|donasi|transaksi)\/.+|^\/akun(\/.*)?$|^\/admin(\/.*)?$/;

async function route(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!GATED.test(pathname)) return NextResponse.next();
  if (pathname.startsWith("/donasi/")) return donationGate(request);
  if (pathname.startsWith("/transaksi/")) return transactionGate(request);
  if (pathname.startsWith("/campaign/")) {
    return canonicalCampaignRedirect(request) ?? campaignExistenceGate(request);
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/masuk") return NextResponse.next();
    const hasAdmin = ADMIN_COOKIES.some((name) => request.cookies.has(name));
    if (!hasAdmin) return redirectTo(request, "/admin/masuk", false);
    return adminPermissionGate(request);
  }
  const hasDonor = DONOR_COOKIES.some((name) => request.cookies.has(name));
  if (!hasDonor) return redirectTo(request, "/masuk", true);
  return donorTransactionGate(request);
}

// Detail transaksi donor (P18): kode tidak ada / milik donor lain → 404 sungguhan (AC-13.1),
// bukan soft 404 setelah streaming. Sesi tidak valid diteruskan ke halaman (requireDonor →
// redirect /masuk).
async function donorTransactionGate(request: NextRequest) {
  const match = /^\/akun\/donasi\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  const code = match[1]!;
  if (!isTransactionCode(code)) return notFoundResponse(request);
  const token = DONOR_COOKIES.map((name) => request.cookies.get(name)?.value).find(Boolean) ?? "";
  try {
    const access = token ? await donorTransactionAccess(token, code) : "no_session";
    return access === "not_found" ? notFoundResponse(request) : NextResponse.next();
  } catch (error) {
    logger.warn("cek transaksi donor gagal; fail-open", { error: safeError(error) });
    return NextResponse.next();
  }
}

// P25: proxy berjalan di semua path (CSP ber-nonce untuk setiap halaman, termasuk 404/error);
// gerbang auth/keberadaan tetap hanya untuk prefix di GATED. Aset statis build & optimizer
// gambar dikecualikan (header statis tetap dari next.config.ts).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
