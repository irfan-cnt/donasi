import "server-only";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { upsertDonorForUser, type DonorRow } from "@/server/repositories/donor-repository";

const userSchema = z.object({
  id: z.uuid(),
  email: z.email().max(320),
  name: z.string().trim().max(120).nullish(),
});

/** Email ternormalisasi: trim + huruf kecil. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pastikan user login punya baris donor (F-09, AC-09.1). Idempoten — aman dipanggil tiap login.
 * Nama default = bagian lokal email bila Google tidak mengirim nama.
 */
export async function ensureDonorAccount(user: unknown): Promise<DonorRow | undefined> {
  const parsed = userSchema.safeParse(user);
  if (!parsed.success) {
    logger.warn("donor-account: data user tidak valid", { issues: parsed.error.issues.length });
    return undefined;
  }
  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name?.trim() || email.split("@")[0]!;
  const donor = await upsertDonorForUser({ userId: parsed.data.id, email, name });
  if (!donor) {
    // Email sudah tertaut ke user lain — jangan menimpa kepemilikan donor.
    logger.warn("donor-account: donor tidak dapat ditautkan", { userId: parsed.data.id });
  }
  return donor;
}
