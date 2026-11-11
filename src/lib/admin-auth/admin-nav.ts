import { hasPermission, type Permission } from "./permissions";

// Menu admin (mockup AdminShell). Setiap halaman memanggil requireAdmin(permission) yang sama
// dengan item menunya (BR-40).
export type AdminNavIcon =
  | "dashboard"
  | "campaign"
  | "news"
  | "transactions"
  | "donors"
  | "payment-methods"
  | "payment-logs"
  | "templates"
  | "notification-logs"
  | "audit";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: AdminNavIcon;
  permission: Permission | null;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { title: "Utama", items: [{ href: "/admin", label: "Dashboard", icon: "dashboard", permission: null }] },
  {
    title: "Konten",
    items: [
      { href: "/admin/campaign", label: "Campaign", icon: "campaign", permission: "campaigns.read" },
      { href: "/admin/berita", label: "Berita", icon: "news", permission: "news.write" },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { href: "/admin/transaksi", label: "Transaksi", icon: "transactions", permission: "transactions.read" },
      { href: "/admin/donatur", label: "Donatur", icon: "donors", permission: "donors.read" },
      {
        href: "/admin/metode-pembayaran",
        label: "Metode Pembayaran",
        icon: "payment-methods",
        permission: "payment_methods.write",
      },
      { href: "/admin/log-pembayaran", label: "Log Pembayaran", icon: "payment-logs", permission: "transactions.read" },
    ],
  },
  {
    title: "Notifikasi",
    items: [
      { href: "/admin/template-notifikasi", label: "Template", icon: "templates", permission: "notifications.write" },
      {
        href: "/admin/log-notifikasi",
        label: "Log Notifikasi",
        icon: "notification-logs",
        permission: "notifications.write",
      },
    ],
  },
  { title: "Sistem", items: [{ href: "/admin/audit", label: "Audit Log", icon: "audit", permission: "audit.read" }] },
];

/** Menu yang boleh dilihat admin (grup kosong dihapus). */
export function navForPermissions(granted: readonly string[]): AdminNavGroup[] {
  return ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.permission === null || hasPermission(granted, i.permission)),
  })).filter((g) => g.items.length > 0);
}
