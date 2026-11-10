"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { adminSearchSchema } from "@/lib/validation/admin-dashboard";
import { adminSearch, type AdminSearchResult } from "@/server/services/admin-dashboard-service";

export interface AdminSearchState {
  results: AdminSearchResult[];
  error?: string;
}

/** Pencarian global admin (topbar). Sesi + Zod + rate limit 30/menit per admin; hasil sesuai permission. */
export async function adminSearchAction(input: unknown): Promise<AdminSearchState> {
  const ctx = await requireAdmin();
  const parsed = adminSearchSchema.safeParse(input);
  if (!parsed.success) return { results: [], error: "Ketik minimal 2 karakter." };
  const limit = await rateLimit("admin-search", ctx.adminId, 30, "1 m");
  if (!limit.success) return { results: [], error: "Terlalu banyak pencarian. Coba lagi sebentar." };
  try {
    return { results: await adminSearch(ctx.permissions, parsed.data.q) };
  } catch (error) {
    logger.error("admin: pencarian gagal", { error: String(error) });
    return { results: [], error: "Pencarian gagal. Silakan coba lagi." };
  }
}
