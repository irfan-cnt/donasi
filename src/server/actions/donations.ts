"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getRequestMeta } from "@/lib/admin-auth";
import { getOptionalDonor } from "@/lib/auth";
import { requestLogger } from "@/lib/logger";
import type { DonationFieldErrors } from "@/lib/validation/donation";
import { createDonation } from "@/server/services/donation-service";

export interface DonationFormState {
  fieldErrors?: DonationFieldErrors;
  /** Pesan umum + kode referensi (requestId) untuk dukungan. */
  error?: string;
  reference?: string;
  status?: number;
}

const FIELDS = [
  "slug",
  "amount",
  "optionId",
  "name",
  "anonymous",
  "email",
  "phone",
  "waConsent",
  "prayer",
  "website",
] as const;

export async function createDonationAction(
  _prev: DonationFormState,
  formData: FormData,
): Promise<DonationFormState> {
  const requestId = randomUUID();
  const reference = `REQ-${requestId.slice(0, 8).toUpperCase()}`;
  const log = requestLogger(requestId).child({ action: "createDonation", reference });

  const raw: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const v = formData.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }

  let target: string;
  try {
    const [meta, donor] = await Promise.all([getRequestMeta(), getOptionalDonor()]);
    const result = await createDonation(raw, {
      sessionDonor: donor ? { donorId: donor.id } : null,
      ip: meta.ip,
      userAgent: meta.ua,
      log,
    });
    if (!result.ok) {
      const general =
        result.fieldErrors.form ??
        (result.reason === "error" ? "Donasi belum dapat diproses karena gangguan sistem." : undefined);
      return {
        status: result.status,
        fieldErrors: result.fieldErrors,
        error: general,
        reference: general ? reference : undefined,
      };
    }
    const qs = new URLSearchParams({ trx: result.code, t: result.accessToken });
    target = `/donasi/${result.slug}/pembayaran?${qs.toString()}`;
  } catch (error) {
    log.error("createDonation gagal", { error: String(error) });
    return {
      status: 500,
      error: "Donasi belum dapat diproses karena gangguan sistem. Silakan coba lagi.",
      reference,
    };
  }
  redirect(target);
}
