import "server-only";
import { inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

// Kontak lembaga untuk halaman /kontak (F-32, AC-32.4). HANYA kunci `organization.*` yang
// diizinkan di bawah — tidak pernah membaca kunci lain dari platform_settings.
export const ORGANIZATION_CONTACT_KEYS = [
  "organization.name",
  "organization.address",
  "organization.email",
  "organization.whatsapp",
] as const;

export interface OrganizationContact {
  name?: string;
  address?: string;
  email?: string;
  whatsapp?: string;
}

/** Murni (teruji): nilai kosong/non-string → undefined agar bagiannya disembunyikan. */
export function toOrganizationContact(rows: { key: string; value: unknown }[]): OrganizationContact {
  const get = (k: (typeof ORGANIZATION_CONTACT_KEYS)[number]) => {
    const v = rows.find((r) => r.key === k)?.value;
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return {
    name: get("organization.name"),
    address: get("organization.address"),
    email: get("organization.email"),
    whatsapp: get("organization.whatsapp"),
  };
}

export async function getOrganizationContact(): Promise<OrganizationContact> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("platform-settings");
  const rows = await getDb()
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings)
    .where(inArray(platformSettings.key, [...ORGANIZATION_CONTACT_KEYS]));
  return toOrganizationContact(rows);
}
