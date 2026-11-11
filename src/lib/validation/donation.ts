import { z } from "zod";

// Validasi checkout donasi (F-04, BR-05–BR-08) dengan Zod: dipakai server action (sumber
// kebenaran). Helper tanpa Zod untuk form klien ada di ./donation-input. Nominal selalu string digit → bigint;
// tidak pernah lewat `Number` agar tidak kehilangan presisi di atas 2^53 (AC-04.2).

export {
  ANONYMOUS_NAME,
  MAX_AMOUNT_DIGITS,
  PRAYER_MAX,
  amountError,
  formatAmountDigits,
  normalizeIndonesianPhone,
  sanitizeAmountInput,
  type AmountBounds,
  type DonationFieldErrors,
} from "./donation-input";
import {
  amountError,
  normalizeIndonesianPhone,
  PRAYER_MAX,
  type AmountBounds,
  type DonationFieldErrors,
} from "./donation-input";

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const optionalText = (max: number, message: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, message));

/**
 * Bentuk input form checkout (sebelum aturan campaign). Nominal tetap string di sini; aturan
 * min/max & paket diterapkan oleh `parseDonationInput` / service dengan data DB.
 */
export const donationFormSchema = z
  .object({
    slug: z.string().trim().min(1).max(200),
    amount: optionalText(32, "Nominal tidak valid."),
    optionId: optionalText(64, "Paket tidak valid."),
    name: optionalText(120, "Nama maksimal 120 karakter."),
    anonymous: checkbox,
    email: optionalText(254, "Email terlalu panjang."),
    phone: optionalText(20, "Nomor WhatsApp tidak valid."),
    waConsent: checkbox,
    prayer: optionalText(PRAYER_MAX, `Doa maksimal ${PRAYER_MAX} karakter.`),
    // Honeypot: manusia tidak melihat field ini; bot biasanya mengisinya.
    website: optionalText(500, "").pipe(z.string().max(0, "Permintaan ditolak.")),
  })
  .superRefine((v, ctx) => {
    if (!v.anonymous && !v.name) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Nama wajib diisi, atau aktifkan opsi Hamba Allah.",
      });
    }
    if (v.email && !z.email().safeParse(v.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Masukkan email yang valid untuk menerima kuitansi.",
      });
    }
    if (v.phone && !normalizeIndonesianPhone(v.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Nomor WhatsApp tidak valid (contoh: 0812 3456 7890).",
      });
    }
  });

const FORM_KEYS = Object.keys(donationFormSchema.shape) as (keyof typeof donationFormSchema.shape)[];

export type DonationForm = z.output<typeof donationFormSchema>;


export interface CampaignAmountRules {
  amountType: "open" | "fixed";
  bounds: AmountBounds;
}

export type ParsedDonation =
  | {
      ok: true;
      data: Omit<DonationForm, "amount" | "optionId" | "phone"> & {
        /** Nominal open (bigint). Untuk fixed = null — nominal diambil dari DB. */
        amount: bigint | null;
        optionId: string | null;
        phoneE164: string | null;
        honeypot: false;
      };
    }
  | { ok: false; honeypot: boolean; fieldErrors: DonationFieldErrors };

/**
 * Validasi penuh input checkout terhadap aturan nominal campaign. Untuk donatur login, pemanggil
 * mengganti `raw.email` dengan email sesi sebelum memanggil fungsi ini (input email diabaikan).
 */
export function parseDonationInput(
  raw: Record<string, unknown>,
  rules: CampaignAmountRules,
): ParsedDonation {
  // Field yang tidak dikirim (FormData kosong / checkbox tidak dicentang) → string kosong.
  const normalized = Object.fromEntries(
    FORM_KEYS.map((k) => [k, typeof raw[k] === "string" ? raw[k] : ""]),
  );
  const parsed = donationFormSchema.safeParse(normalized);
  const fieldErrors: DonationFieldErrors = {};
  if (!parsed.success) {
    let honeypot = false;
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (key === "website") honeypot = true;
      const field = (["amount", "optionId", "name", "email", "phone", "prayer"].includes(key)
        ? key
        : "form") as keyof DonationFieldErrors;
      fieldErrors[field] ??= issue.message || "Input tidak valid.";
    }
    if (honeypot) return { ok: false, honeypot: true, fieldErrors: { form: "Permintaan ditolak." } };
  }
  const v = parsed.success ? parsed.data : null;
  const rawEmail = typeof raw.email === "string" ? raw.email.trim() : "";
  if (!rawEmail) fieldErrors.email = "Email wajib diisi.";

  let amount: bigint | null = null;
  let optionId: string | null = null;
  if (rules.amountType === "open") {
    const digits = typeof raw.amount === "string" ? raw.amount.trim() : "";
    const err = amountError(digits, rules.bounds);
    if (err) fieldErrors.amount = err;
    else amount = BigInt(digits);
  } else {
    // Fixed: nominal dari client diabaikan sepenuhnya (AC-04.5).
    const id = typeof raw.optionId === "string" ? raw.optionId.trim() : "";
    if (!z.uuid().safeParse(id).success) fieldErrors.optionId = "Pilih salah satu paket.";
    else optionId = id;
  }

  if (!v || Object.keys(fieldErrors).length > 0) {
    return { ok: false, honeypot: false, fieldErrors };
  }
  const phoneE164 = v.phone ? normalizeIndonesianPhone(v.phone) : null;
  return {
    ok: true,
    data: {
      slug: v.slug,
      name: v.name,
      anonymous: v.anonymous,
      email: v.email.toLowerCase(),
      waConsent: v.waConsent && phoneE164 !== null,
      prayer: v.prayer,
      website: v.website,
      amount,
      optionId,
      phoneE164,
      honeypot: false,
    },
  };
}
