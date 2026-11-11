import "server-only";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getEnv } from "@/lib/env";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import {
  findAdminById,
  findAdminSessionByHash,
  insertAdminSession,
  loadAdminAccess,
  revokeAdminSessionByHash,
  touchAdminSession,
} from "@/server/repositories/admin-repository";
import { hasPermission, type Permission } from "./permissions";
import { ADMIN_ABSOLUTE_TIMEOUT_MS, ADMIN_TOUCH_INTERVAL_MS, checkSession } from "./session-policy";
import { clientIp } from "@/lib/http/client-ip";

export const ADMIN_LOGIN_PATH = "/admin/masuk";
export const ADMIN_CHANGE_PASSWORD_PATH = "/admin/ganti-password";
export const ADMIN_TOTP_SETUP_PATH = "/admin/setup-totp";

/**
 * Cookie sesi admin. Di preview/production SELALU `__Host-tk_admin` (Secure, Path=/, tanpa
 * Domain). Di APP_ENV=development (http://localhost) prefix `__Host-` & Secure tidak bisa
 * dipakai browser, jadi memakai `tk_admin` — sama seperti cookie donor P04.
 */
export function adminCookieConfig(): { name: string; secure: boolean } {
  const secure = getEnv().APP_ENV !== "development";
  return { name: secure ? "__Host-tk_admin" : "tk_admin", secure };
}

export const ADMIN_COOKIE_NAMES = ["__Host-tk_admin", "tk_admin"] as const;

export async function getRequestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const ip = clientIp(h); // P25 (I1)
  return { ip, ua: h.get("user-agent")?.slice(0, 512) ?? null };
}

/** Buat sesi baru (rotasi: sesi lama di cookie dicabut) lalu set cookie. */
export async function startAdminSession(adminUserId: string): Promise<void> {
  const jar = await cookies();
  const { name, secure } = adminCookieConfig();
  const old = jar.get(name)?.value;
  if (old) await revokeAdminSessionByHash(sha256(old));

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_ABSOLUTE_TIMEOUT_MS);
  const { ip, ua } = await getRequestMeta();
  await insertAdminSession({ adminUserId, tokenHash: sha256(token), ip, userAgent: ua, expiresAt });
  jar.set(name, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  const { name } = adminCookieConfig();
  const token = jar.get(name)?.value;
  if (token) await revokeAdminSessionByHash(sha256(token));
  jar.delete(name);
}

export interface AdminContext {
  sessionId: string;
  adminId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  totpEnabled: boolean;
  /** Langkah wajib yang belum selesai (login pertama). */
  pendingStep: "change-password" | "totp-setup" | null;
}

/** Validasi sesi dari cookie admin (bukan cookie donor). Di-cache per request. */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const jar = await cookies();
  const token = jar.get(adminCookieConfig().name)?.value;
  if (!token || token.length > 128) return null;

  const session = await findAdminSessionByHash(sha256(token));
  if (!session) return null;
  const now = new Date();
  if (checkSession(session, now) !== "valid") return null;

  const admin = await findAdminById(session.adminUserId);
  if (!admin || admin.status === "disabled") return null;

  if (now.getTime() - session.lastSeenAt.getTime() >= ADMIN_TOUCH_INTERVAL_MS) {
    await touchAdminSession(session.id, now);
  }
  const access = await loadAdminAccess(admin.id);
  const pendingStep = admin.mustChangePassword
    ? "change-password"
    : !admin.totpEnabled // P25 (OD-29): TOTP wajib semua role
      ? "totp-setup"
      : null;
  return {
    sessionId: session.id,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    roles: access.roles,
    permissions: access.permissions,
    mustChangePassword: admin.mustChangePassword,
    totpEnabled: admin.totpEnabled,
    pendingStep,
  };
});

export interface RequireAdminOptions {
  /** Hanya untuk halaman/action ganti password & setup TOTP. */
  allowPendingStep?: boolean;
}

/**
 * Guard admin (security.md §3). WAJIB dipanggil di setiap layout/halaman/server action/route
 * admin. Sesi donor tidak pernah lolos (cookie & tabel berbeda).
 * - tanpa sesi valid → redirect /admin/masuk
 * - langkah login pertama belum selesai → redirect ke langkahnya
 * - tidak punya `permission` → 403 (forbidden())
 */
export async function requireAdmin(
  permission?: Permission | null,
  options: RequireAdminOptions = {},
): Promise<AdminContext> {
  await connection();
  const ctx = await getAdminContext();
  if (!ctx) redirect(ADMIN_LOGIN_PATH);
  if (!options.allowPendingStep && ctx.pendingStep) {
    redirect(
      ctx.pendingStep === "change-password" ? ADMIN_CHANGE_PASSWORD_PATH : ADMIN_TOTP_SETUP_PATH,
    );
  }
  if (permission && !hasPermission(ctx.permissions, permission)) forbidden();
  return ctx;
}

/**
 * Bentuk requireAdmin untuk ROUTE HANDLER API admin (P22): validasi sesi & permission yang sama,
 * tetapi menghasilkan respons HTTP nyata — 401 tanpa sesi / langkah login belum selesai,
 * 403 tanpa permission — bukan redirect/forbidden() (yang di route stream 200/307).
 */
export async function requireAdminApi(
  /** Satu permission, atau daftar = cukup salah satu (P25: upload gambar). */
  permission: Permission | readonly Permission[],
): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: Response }> {
  await connection();
  const deny = (status: 401 | 403, error: string) => ({
    ok: false as const,
    response: Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } }),
  });
  const ctx = await getAdminContext();
  if (!ctx || ctx.pendingStep) return deny(401, "Sesi admin tidak valid. Silakan masuk kembali.");
  const anyOf: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
  if (!anyOf.some((p) => hasPermission(ctx.permissions, p))) return deny(403, "Anda tidak punya izin untuk aksi ini.");
  return { ok: true, ctx };
}
