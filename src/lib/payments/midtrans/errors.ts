// Error domain Midtrans → pesan ramah donatur (Bahasa Indonesia). Tidak pernah berisi secret.

export type MidtransErrorCode =
  | "validation"
  | "unauthorized"
  | "channel_unavailable"
  | "duplicate_order"
  | "not_found"
  | "not_permitted"
  | "rate_limited"
  | "provider_unavailable"
  | "network"
  | "timeout"
  | "invalid_response"
  | "unmapped_status"
  | "invalid_signature";

const USER_MESSAGES: Record<MidtransErrorCode, string> = {
  validation:
    "Data pembayaran tidak dapat diproses. Silakan periksa kembali atau pilih metode lain.",
  unauthorized: "Layanan pembayaran sedang tidak tersedia. Silakan coba beberapa saat lagi.",
  channel_unavailable: "Metode pembayaran ini sedang tidak tersedia. Silakan pilih metode lain.",
  duplicate_order: "Pembayaran ini sudah pernah dibuat. Silakan muat ulang halaman.",
  not_found: "Data pembayaran tidak ditemukan di penyedia pembayaran.",
  not_permitted: "Status pembayaran tidak dapat diubah lagi.",
  rate_limited: "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa saat.",
  provider_unavailable:
    "Layanan pembayaran sedang gangguan. Silakan coba lagi atau pilih metode lain.",
  network: "Koneksi ke layanan pembayaran gagal. Silakan coba lagi.",
  timeout: "Layanan pembayaran tidak merespons. Silakan coba lagi beberapa saat lagi.",
  invalid_response: "Layanan pembayaran memberikan respons tidak terduga. Silakan coba lagi.",
  unmapped_status: "Status pembayaran belum dapat dipastikan. Tim kami akan memeriksanya.",
  invalid_signature: "Notifikasi pembayaran tidak valid.",
};

export class MidtransError extends Error {
  readonly code: MidtransErrorCode;
  readonly userMessage: string;
  /** Kode HTTP / status_code Midtrans bila ada. */
  readonly providerStatus?: string;
  /** Aman untuk dicoba ulang oleh donatur (transaksi tetap bisa dibayar). */
  readonly retryable: boolean;

  constructor(code: MidtransErrorCode, detail: string, providerStatus?: string) {
    super(`midtrans:${code} ${detail}`);
    this.name = "MidtransError";
    this.code = code;
    this.userMessage = USER_MESSAGES[code];
    this.providerStatus = providerStatus;
    this.retryable = ["rate_limited", "provider_unavailable", "network", "timeout"].includes(code);
  }
}

/** Petakan status_code Midtrans (body atau HTTP) ke error domain. */
export function errorFromStatusCode(statusCode: string, detail: string): MidtransError {
  const n = Number(statusCode);
  if (n === 400) return new MidtransError("validation", detail, statusCode);
  // 402 "Payment channel is not activated" (terverifikasi di sandbox).
  if (n === 402) return new MidtransError("channel_unavailable", detail, statusCode);
  if (n === 401 || n === 403) return new MidtransError("unauthorized", detail, statusCode);
  if (n === 404) return new MidtransError("not_found", detail, statusCode);
  if (n === 406) return new MidtransError("duplicate_order", detail, statusCode);
  if (n === 412) return new MidtransError("not_permitted", detail, statusCode);
  if (n === 429) return new MidtransError("rate_limited", detail, statusCode);
  if (n >= 500) return new MidtransError("provider_unavailable", detail, statusCode);
  return new MidtransError("invalid_response", detail, statusCode);
}
