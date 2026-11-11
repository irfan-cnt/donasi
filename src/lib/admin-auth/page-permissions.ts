import type { Permission } from "./permissions";

/**
 * P25 (L2): permission halaman admin, dipakai proxy untuk mengembalikan HTTP 403 sungguhan
 * SEBELUM streaming (dengan cacheComponents, forbidden() di dalam Suspense hanya bisa
 * menampilkan UI 403 berstatus 200). Halaman tetap memanggil requireAdmin(permission) sendiri;
 * tests/unit/admin-page-permissions.test.ts memastikan tabel ini sama dengan kode halaman.
 * Urutan penting: prefix paling spesifik lebih dulu.
 */
export const ADMIN_PAGE_PERMISSIONS: readonly (readonly [prefix: string, permission: Permission])[] = [
  ["/admin/audit", "audit.read"],
  ["/admin/berita", "news.write"],
  ["/admin/campaign/baru", "campaigns.write"],
  ["/admin/campaign", "campaigns.read"],
  ["/admin/donatur", "donors.read"],
  ["/admin/log-notifikasi", "notifications.write"],
  ["/admin/log-pembayaran", "transactions.read"],
  ["/admin/metode-pembayaran", "payment_methods.write"],
  ["/admin/template-notifikasi", "notifications.write"],
  ["/admin/transaksi", "transactions.read"],
];

export function adminPagePermission(pathname: string): Permission | null {
  const hit = ADMIN_PAGE_PERMISSIONS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? hit[1] : null;
}
