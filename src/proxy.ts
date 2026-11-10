import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { sha256 } from "@/lib/security/crypto";
import { readCampaignPreviewToken } from "@/lib/security/preview-token";
import { normalizeSlug } from "@/lib/slug";
import { isTransactionCode } from "@/lib/transaction-code";
import {
  donorTransactionAccess,
  previewCampaignExists,
  publicCampaignExists,
  publicNewsExists,
  transactionAccessExists,
  transactionTokenValid,
} from "@/server/queries/public-route-exists";

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
    logger.warn("cek keberadaan campaign gagal; fail-open", { error: String(error) });
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
    logger.warn("cek rute donasi gagal; fail-open", { error: String(error) });
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
    logger.warn("cek rute transaksi gagal; fail-open", { error: String(error) });
    return NextResponse.next();
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/donasi/")) return donationGate(request);
  if (pathname.startsWith("/transaksi/")) return transactionGate(request);
  if (pathname.startsWith("/campaign/")) {
    return canonicalCampaignRedirect(request) ?? campaignExistenceGate(request);
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/masuk") return NextResponse.next();
    const hasAdmin = ADMIN_COOKIES.some((name) => request.cookies.has(name));
    return hasAdmin ? NextResponse.next() : redirectTo(request, "/admin/masuk", false);
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
    logger.warn("cek transaksi donor gagal; fail-open", { error: String(error) });
    return NextResponse.next();
  }
}

export const config = { matcher: ["/campaign/:path+", "/donasi/:path+", "/transaksi/:path+", "/akun", "/akun/:path*", "/admin", "/admin/:path*"] };
