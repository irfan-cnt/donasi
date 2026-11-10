import { NextResponse, type NextRequest } from "next/server";

// Lapisan pertama saja (optimistic): cek keberadaan cookie sesi. Validasi sesi
// sebenarnya ada di requireDonor() pada layout/halaman/action (security.md §3).
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/masuk";
  url.search = "";
  url.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/akun", "/akun/:path*"] };
