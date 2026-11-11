"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getRequestMeta } from "@/lib/admin-auth";
import { requireDonor } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import {
  accountDeletionSchema,
  donorProfileSchema,
  donorTrxCode,
  type DonorProfileFieldErrors,
} from "@/lib/validation/donor";
import { continuePayment, deleteDonorAccount, saveDonorProfile } from "@/server/services/donor-account-service";
import { safeError } from "@/lib/safe-error";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : undefined);

export interface ProfileFormState {
  ok?: boolean;
  fieldErrors?: DonorProfileFieldErrors;
}

/** Simpan profil (F-15). donorId SELALU dari sesi; email tidak pernah diterima dari form. */
export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const donor = await requireDonor("/akun/profil");
  const parsed = donorProfileSchema.safeParse({
    name: str(formData.get("name")),
    phone: str(formData.get("phone")),
    whatsappOptIn: str(formData.get("whatsappOptIn")) ?? null,
    defaultAnonymous: str(formData.get("defaultAnonymous")) ?? null,
  });
  if (!parsed.success) {
    const fieldErrors: DonorProfileFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "name" || issue.path[0] === "phone" ? issue.path[0] : "form";
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  try {
    await saveDonorProfile(donor.donorId, parsed.data, await getRequestMeta());
  } catch (error) {
    logger.error("donor: simpan profil gagal", { error: safeError(error) });
    return { fieldErrors: { form: "Profil gagal disimpan. Silakan coba lagi." } };
  }
  revalidatePath("/akun", "layout");
  return { ok: true };
}

export interface DeletionFormState {
  error?: string;
}

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/** Ajukan hapus akun: konfirmasi ketik HAPUS → anonimisasi (database-security.md §6). */
export async function requestAccountDeletionAction(_prev: DeletionFormState, formData: FormData): Promise<DeletionFormState> {
  const donor = await requireDonor("/akun/profil");
  const parsed = accountDeletionSchema.safeParse({ confirm: str(formData.get("confirm")) ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Konfirmasi tidak valid." };
  let done = false;
  try {
    done = await deleteDonorAccount({ donorId: donor.donorId, userId: donor.userId, ...(await getRequestMeta()) });
  } catch (error) {
    logger.error("donor: hapus akun gagal", { error: safeError(error) });
  }
  if (!done) return { error: "Akun gagal dihapus. Silakan coba lagi atau hubungi kami." };
  // Sesi DB sudah terhapus (cascade users); bersihkan cookie juga.
  const store = await cookies();
  for (const name of SESSION_COOKIES) store.delete(name);
  redirect("/?akun=dihapus");
}

/** Lanjut bayar transaksi pending milik donor (token baru). Milik orang lain → 404. */
export async function continuePaymentAction(formData: FormData): Promise<void> {
  const donor = await requireDonor("/akun/donasi");
  const code = donorTrxCode.safeParse(str(formData.get("code")));
  if (!code.success) notFound();
  // 10 penerbitan token / jam per donor (fail-open bila Redis gagal, OD-15).
  const limited = await rateLimit("continue-payment", donor.donorId, 10, "1 h").then(
    (r) => !r.success,
    (error: unknown) => {
      logger.error("rate limit lanjut bayar tidak tersedia; fail-open", { error: safeError(error) });
      return false;
    },
  );
  if (limited) redirect(`/akun/donasi/${code.data}?batas=1`);
  const url = await continuePayment(donor.donorId, code.data);
  if (!url) notFound();
  redirect(url);
}
