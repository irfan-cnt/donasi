// Kode permission BR-40 (sumber data: tabel permissions/role_permissions, di-seed dari
// scripts/seed/reference-data.ts). Modul murni: dipakai requireAdmin dan test.
export const PERMISSION_CODES = [
  "campaigns.read",
  "campaigns.write",
  "campaigns.publish",
  "news.write",
  "news.publish",
  "transactions.read",
  "transactions.export",
  "transactions.reconcile",
  "donors.read",
  "donors.export",
  "payment_methods.write",
  "disbursements.write",
  "notifications.write",
  "settings.write",
  "admins.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSION_CODES)[number];

export function hasPermission(granted: Iterable<string>, required: Permission): boolean {
  for (const p of granted) if (p === required) return true;
  return false;
}
