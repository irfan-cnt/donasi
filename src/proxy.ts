import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { readCampaignPreviewToken } from "@/lib/security/preview-token";
import { normalizeSlug } from "@/lib/slug";
import {
  previewCampaignExists,
  publicCampaignExists,
  publicNewsExists,
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/campaign/")) {
    return canonicalCampaignRedirect(request) ?? campaignExistenceGate(request);
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/masuk") return NextResponse.next();
    const hasAdmin = ADMIN_COOKIES.some((name) => request.cookies.has(name));
    return hasAdmin ? NextResponse.next() : redirectTo(request, "/admin/masuk", false);
  }
  const hasDonor = DONOR_COOKIES.some((name) => request.cookies.has(name));
  return hasDonor ? NextResponse.next() : redirectTo(request, "/masuk", true);
}

export const config = { matcher: ["/campaign/:path+", "/akun", "/akun/:path*", "/admin", "/admin/:path*"] };
