import { NextResponse, type NextRequest } from "next/server";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/masuk") return NextResponse.next();
    const hasAdmin = ADMIN_COOKIES.some((name) => request.cookies.has(name));
    return hasAdmin ? NextResponse.next() : redirectTo(request, "/admin/masuk", false);
  }
  const hasDonor = DONOR_COOKIES.some((name) => request.cookies.has(name));
  return hasDonor ? NextResponse.next() : redirectTo(request, "/masuk", true);
}

export const config = { matcher: ["/akun", "/akun/:path*", "/admin", "/admin/:path*"] };
