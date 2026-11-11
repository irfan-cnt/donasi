import "server-only";
import { getEnv } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { MidtransError } from "@/lib/payments/midtrans";
import { groupMethods, type AvailableMethod, type MethodGroup } from "@/lib/payments/method-groups";
import { getProvider, isProviderConfigured } from "@/lib/payments/registry";
import type { PaymentProvider, ProviderCode } from "@/lib/payments/types";
import { publishJob } from "@/lib/qstash";
import { acquireLock, rateLimit, releaseLock } from "@/lib/redis";
import { cachedJson, invalidateCache } from "@/lib/redis/cache";
import { sha256 } from "@/lib/security/crypto";
import { siteUrl } from "@/lib/site";
import { createPaymentInput } from "@/lib/validation/payment";
import { formatRupiah } from "@/lib/money";
import { renderInstructionSections, type InstructionSection } from "@/lib/payments/instruction-template";
import {
  activatePayment,
  cancelPendingPayment,
  recordOrphanCharge,
  findActiveMethodByCode,
  findActivePayment,
  findPayableTransaction,
  findPaymentForView,
  findTransactionStatus,
  insertCreatedPayment,
  listActiveMethodRows,
  markPaymentFailed,
  type MethodRow,
  type PayableTransaction,
} from "@/server/repositories/payment-repository";
import { newId } from "@/lib/id";

// Select Payment & createPayment (T-20, T-25, F-05). Status `paid` TIDAK pernah ditulis di sini
// (BR-18): hanya created → pending / failed dan pending → cancelled (ganti metode, BR-17).

const METHODS_CACHE_KEY = "payment-methods:active:v1";
const METHODS_CACHE_TTL_S = 300;
/** Menutup expire (10 s) + charge (10 s) + pemulihan Get Status (≤20 s) + margin. */
const LOCK_TTL_MS = 60_000;
/** Payment pending dengan sisa waktu < ini tidak dipakai ulang (dibuat baru). */
const REUSE_MIN_REMAINING_MS = 60_000;
const PAYABLE_STATUSES = new Set(["created", "pending"]);

type CachedMethod = Omit<MethodRow, "minAmount" | "maxAmount"> & {
  minAmount: string;
  maxAmount: string | null;
};

/** Metode aktif provider yang di-enable (cache Redis 5 menit; dev tanpa Redis → DB langsung). */
export async function listActiveMethods(): Promise<MethodRow[]> {
  return cachedJson(METHODS_CACHE_KEY, METHODS_CACHE_TTL_S, listActiveMethodRows, {
    serialize: (rows): CachedMethod[] =>
      rows.map((r) => ({
        ...r,
        minAmount: r.minAmount.toString(),
        maxAmount: r.maxAmount === null ? null : r.maxAmount.toString(),
      })),
    deserialize: (raw) =>
      (raw as CachedMethod[]).map((r) => ({
        ...r,
        minAmount: BigInt(r.minAmount),
        maxAmount: r.maxAmount === null ? null : BigInt(r.maxAmount),
      })),
  });
}

/** Dipanggil admin (P22) setelah mengubah payment_methods / payment_providers. */
export async function invalidatePaymentMethodsCache(): Promise<void> {
  await invalidateCache(METHODS_CACHE_KEY);
}

/** Grup metode untuk nominal transaksi; hanya provider yang env-nya terkonfigurasi. */
export async function getMethodGroups(amount: bigint): Promise<MethodGroup[]> {
  const rows = await listActiveMethods();
  const configured = rows.filter((r) => isProviderConfigured(r.providerCode));
  return groupMethods(configured.map(toAvailable), amount);
}

function toAvailable(r: MethodRow): AvailableMethod {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    displayName: r.displayName,
    logoUrl: r.logoUrl,
    minAmount: r.minAmount,
    maxAmount: r.maxAmount,
    expiryMinutes: r.expiryMinutes,
    displayOrder: r.displayOrder,
  };
}

export interface SelectPaymentView {
  transaction: PayableTransaction;
  groups: MethodGroup[];
  /** Metode payment pending yang masih berlaku (pra-pilih). */
  currentMethod: string | null;
}

/** Data halaman Select Payment; null = 404 (token salah/kedaluwarsa/slug tidak cocok). */
export async function getSelectPaymentView(
  slug: string,
  code: string,
  token: string,
  now = new Date(),
): Promise<SelectPaymentView | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const trx = await findPayableTransaction(code, sha256(token), now);
  if (!trx || trx.campaignSlug !== slug) return null;
  const [groups, active] = await Promise.all([
    PAYABLE_STATUSES.has(trx.status) ? getMethodGroups(trx.amount) : Promise.resolve([]),
    trx.status === "pending" ? findActivePayment(trx.id) : Promise.resolve(undefined),
  ]);
  return { transaction: trx, groups, currentMethod: active?.status === "pending" ? active.methodCode : null };
}

// ---------------------------------------------------------------------------------------------

export type CreatePaymentReason =
  | "invalid"
  | "not_found"
  | "not_payable"
  | "method_unavailable"
  | "in_progress"
  | "rate_limited"
  | "provider_error"
  | "error";

export type CreatePaymentResult =
  | { ok: true; code: string; reused: boolean; paymentId: string }
  | { ok: false; reason: CreatePaymentReason; message: string; retryable: boolean };

export interface CreatePaymentDeps {
  getProvider: (code: ProviderCode) => PaymentProvider | null;
  acquireLock: (name: string, ttlMs: number) => Promise<string | null>;
  releaseLock: (name: string, owner: string) => Promise<void>;
  enqueuePaymentPending: (job: PaymentPendingJob, log: Logger) => Promise<void>;
  now: () => Date;
  /** P25 (L6): default limiter Upstash. */
  rateLimit?: typeof rateLimit;
}

/** P25 (L6): buat/ganti metode = charge Midtrans baru → dibatasi per transaksi & per IP. */
export const CREATE_PAYMENT_LIMITS = {
  perTransaction: { limit: 10, window: "1 h" },
  perIp: { limit: 30, window: "1 h" },
} as const;

export interface PaymentPendingJob {
  event: "payment.pending";
  transactionId: string;
  paymentId: string;
}

/**
 * Enqueue notifikasi payment.pending (handler /api/jobs/notify dibuat di P16). Tanpa QStash:
 * hanya di APP_ENV=development → log & lewati (preview/production mewajibkan QSTASH_* di env.ts).
 * Gagal publish tidak menggagalkan pembayaran (sudah dibuat di provider) — dicatat error.
 */
export async function enqueuePaymentPending(job: PaymentPendingJob, log: Logger): Promise<void> {
  const env = getEnv();
  if (!env.QSTASH_TOKEN) {
    if (env.APP_ENV === "development") {
      log.info("qstash tidak dikonfigurasi (development); notifikasi payment.pending dilewati", {
        paymentId: job.paymentId,
      });
      return;
    }
    log.error("QSTASH_TOKEN kosong di luar development", { paymentId: job.paymentId });
    return;
  }
  try {
    await publishJob(`${siteUrl()}/api/jobs/notify`, job, {
      deduplicationId: `payment-pending-${job.paymentId}`,
      retries: 3,
    });
  } catch (error) {
    log.error("publish notifikasi payment.pending gagal", {
      paymentId: job.paymentId,
      error: errorCode(error),
    });
  }
}

const defaultDeps: CreatePaymentDeps = {
  getProvider: (code) => getProvider(code),
  acquireLock,
  releaseLock,
  enqueuePaymentPending,
  now: () => new Date(),
};

const MSG = {
  invalid: "Permintaan tidak valid. Silakan muat ulang halaman.",
  notFound: "Transaksi tidak ditemukan atau tautan sudah kedaluwarsa.",
  notPayable: "Transaksi ini sudah tidak dapat dibayar.",
  methodUnavailable: "Metode pembayaran ini sedang tidak tersedia. Silakan pilih metode lain.",
  inProgress: "Pembayaran sedang diproses. Mohon tunggu beberapa detik lalu coba lagi.",
  busy: "Layanan sedang sibuk. Silakan coba lagi beberapa saat lagi.",
  tooMany: "Terlalu sering mengganti metode pembayaran. Silakan coba lagi nanti.",
  generic: "Pembayaran belum dapat dibuat karena gangguan sistem. Silakan coba lagi.",
} as const;

const fail = (
  reason: CreatePaymentReason,
  message: string,
  retryable = true,
): CreatePaymentResult => ({ ok: false, reason, message, retryable });

/**
 * Ringkasan error aman untuk failure_reason/log: kode MidtransError (+ status provider) atau nama
 * kelas error saja — tidak pernah String(error) (bisa memuat body request/PII).
 */
function errorCode(error: unknown): string {
  if (error instanceof MidtransError) {
    return `midtrans:${error.code}${error.providerStatus ? `:${error.providerStatus}` : ""}`;
  }
  const e = error as { code?: unknown; cause?: { code?: unknown } };
  const pg = e?.code ?? e?.cause?.code;
  if (typeof pg === "string" && /^[0-9A-Z]{5}$/.test(pg)) return `db:${pg}`;
  return error instanceof Error ? error.name.slice(0, 50) : "unknown";
}

function providerFailure(error: unknown, log: Logger, what: string): CreatePaymentResult {
  if (error instanceof MidtransError) {
    log.warn(`${what} gagal`, { code: error.code, providerStatus: error.providerStatus });
    return fail("provider_error", error.userMessage, true);
  }
  log.error(`${what} gagal`, { error: errorCode(error) });
  return fail("provider_error", MSG.generic, true);
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return (e?.code ?? e?.cause?.code) === "23505";
}

/**
 * createPayment (T-25). Urutan:
 * 1. Validasi Zod + token (hash) + slug; transaksi harus created/pending; metode aktif & nominal didukung.
 * 2. Lock Redis per transaksi 15 s (klik ganda) — indeks DB satu-aktif sebagai cadangan.
 * 3. Payment pending metode sama & masih berlaku → pakai ulang (tanpa charge baru).
 * 4. Insert payment `created` (id UUIDv7 = order_id).
 * 5. Payment pending metode lain → provider.expirePayment lebih dulu (BR-17).
 * 6. provider.createPayment → satu transaksi DB: lama cancelled, baru pending, transaksi pending.
 * 7. Enqueue payment.pending. Error provider → payment baru `failed`, pesan ramah, bisa dicoba lagi
 *    (error tercatat di payment_events oleh adapter).
 */
export async function createPaymentForTransaction(
  raw: Record<string, unknown>,
  log: Logger,
  deps: CreatePaymentDeps = defaultDeps,
  ip: string | null = null,
): Promise<CreatePaymentResult> {
  const parsed = createPaymentInput.safeParse(raw);
  if (!parsed.success) return fail("invalid", MSG.invalid, false);
  const input = parsed.data;
  const now = deps.now();

  const trx = await findPayableTransaction(input.trx, sha256(input.t), now);
  if (!trx || trx.campaignSlug !== input.slug) return fail("not_found", MSG.notFound, false);
  if (!PAYABLE_STATUSES.has(trx.status)) return fail("not_payable", MSG.notPayable, false);

  const method = await findActiveMethodByCode(input.method);
  const provider = method ? deps.getProvider(method.providerCode) : null;
  if (!method || !provider || !groupMethods([toAvailable(method)], trx.amount).length) {
    return fail("method_unavailable", MSG.methodUnavailable);
  }

  const plog = log.child({ transactionId: trx.id, method: method.code });
  // P25 (L6): rate limit SEBELUM charge. Fail-closed di preview/production (sama dengan lock):
  // tanpa Redis tidak ada charge baru — transaksi tetap bisa dibayar dengan instruksi yang ada.
  const limiter = deps.rateLimit ?? rateLimit;
  try {
    const { perTransaction: pt, perIp: pi } = CREATE_PAYMENT_LIMITS;
    const trxOk = (await limiter("create-payment-trx", trx.id, pt.limit, pt.window)).success;
    const ipOk = !trxOk || !ip ? true : (await limiter("create-payment-ip", ip, pi.limit, pi.window)).success;
    if (!trxOk || !ipOk) {
      plog.warn("create payment rate limit terlampaui", { by: trxOk ? "ip" : "transaction" });
      return fail("rate_limited", MSG.tooMany);
    }
  } catch (error) {
    if (getEnv().APP_ENV !== "development") {
      plog.error("rate limit create payment tidak tersedia; fail-closed", { error: errorCode(error) });
      return fail("in_progress", MSG.busy);
    }
    plog.warn("rate limit create payment tidak tersedia (development); lanjut", { error: errorCode(error) });
  }
  const lockName = `payment:${trx.id}`;
  let owner: string | null;
  try {
    owner = await deps.acquireLock(lockName, LOCK_TTL_MS);
  } catch (error) {
    // Redis gagal: fail-closed di preview/production; development tetap lanjut (indeks DB menjaga).
    if (getEnv().APP_ENV !== "development") {
      plog.error("lock redis tidak tersedia; fail-closed", { error: errorCode(error) });
      return fail("in_progress", MSG.busy);
    }
    plog.warn("lock redis tidak tersedia (development); lanjut", { error: errorCode(error) });
    owner = "no-lock";
  }
  if (!owner) return fail("in_progress", MSG.inProgress);

  try {
    return await createLocked(trx, method, provider, plog, deps);
  } finally {
    if (owner !== "no-lock") {
      await deps.releaseLock(lockName, owner).catch((error: unknown) => {
        plog.warn("lepas lock gagal (kedaluwarsa sendiri)", { error: errorCode(error) });
      });
    }
  }
}

async function createLocked(
  trx: PayableTransaction,
  method: MethodRow,
  provider: PaymentProvider,
  log: Logger,
  deps: CreatePaymentDeps,
): Promise<CreatePaymentResult> {
  const now = deps.now();
  const active = await findActivePayment(trx.id);
  if (active?.status === "paid") return fail("not_payable", MSG.notPayable, false);
  if (
    active &&
    active.methodCode === method.code &&
    active.expiresAt &&
    active.expiresAt.getTime() - now.getTime() > REUSE_MIN_REMAINING_MS
  ) {
    log.info("payment pending dipakai ulang", { paymentId: active.id });
    return { ok: true, code: trx.code, reused: true, paymentId: active.id };
  }

  const paymentId = newId();
  const inserted = await insertCreatedPayment({
    id: paymentId,
    transactionId: trx.id,
    paymentMethodId: method.id,
    providerId: method.providerId,
    amount: trx.amount,
  });
  if (!inserted) return fail("not_payable", MSG.notPayable, false);
  const plog = log.child({ paymentId });

  // BR-17: expire payment lama ke provider dulu. Gagal → payment lama tetap pending (masih sah).
  if (active) {
    const oldProvider = deps.getProvider(active.providerCode);
    try {
      if (!oldProvider) throw new Error("provider payment lama tidak terkonfigurasi");
      await oldProvider.expirePayment({ providerRef: active.providerRef ?? "", orderId: active.id });
    } catch (error) {
      await markPaymentFailed(paymentId, `expire payment lama gagal: ${errorCode(error)}`);
      return providerFailure(error, plog, "expire payment lama");
    }
    // Charge lama sudah mati di provider → segera cancelled di DB agar tidak pernah dipakai ulang,
    // apa pun hasil langkah berikutnya. Transaksi tetap `pending` (tidak pernah cancelled).
    try {
      await cancelPendingPayment(active.id, "diganti metode lain");
    } catch (error) {
      plog.error("cancel payment lama gagal setelah expire", { oldPaymentId: active.id, error: errorCode(error) });
      await markPaymentFailed(paymentId, `cancel payment lama gagal: ${errorCode(error)}`).catch(() => {});
      return fail("error", MSG.generic);
    }
  }

  let created;
  try {
    created = await provider.createPayment({
      paymentId,
      transactionCode: trx.code,
      amount: trx.amount,
      method: { code: method.code, type: method.type, providerChannel: method.providerChannel },
      customer: {
        name: trx.donorName,
        email: trx.donorEmail,
        phone: trx.donorPhone ?? undefined,
      },
      description: trx.campaignTitle,
      campaignId: trx.campaignId,
      expiresInMinutes: method.expiryMinutes,
      // Callback e-wallet → halaman menunggu TANPA access token (URL ini tersimpan di Midtrans/
      // log provider). Tanpa ?t= halaman hanya generik (payment-architecture.md §3c).
      successRedirectUrl: `${siteUrl()}/transaksi/${trx.code}/menunggu`,
    });
  } catch (error) {
    await markPaymentFailed(paymentId, errorCode(error));
    // Payment lama (bila ada) sudah cancelled; transaksi tetap `pending` → bisa memilih metode lagi.
    return providerFailure(error, plog, "createPayment provider");
  }

  try {
    const outcome = await activatePayment({
      transactionId: trx.id,
      paymentId,
      cancelPaymentId: active?.id ?? null,
      providerRef: created.providerRef,
      instruction: created.instruction,
      expiresAt: created.instruction.expiresAt,
    });
    if (outcome === "transaction_closed") {
      await expireOrphanCharge(provider, trx.id, paymentId, created.providerRef, "transaction_closed", plog);
      return fail("not_payable", MSG.notPayable, false);
    }
  } catch (error) {
    // Klik ganda yang lolos lock / payment lama baru saja paid: indeks satu-aktif menolak.
    // provider_ref disimpan agar rekonsiliasi (P14) menemukan charge-nya; bila bentrok
    // payments_provider_ref_key, simpan tanpa provider_ref (ada di audit orphan_charge / log).
    await markPaymentFailed(paymentId, `aktivasi gagal: ${errorCode(error)}`, created.providerRef)
      .catch(() => markPaymentFailed(paymentId, `aktivasi gagal: ${errorCode(error)}`))
      .catch((e: unknown) => plog.error("tandai payment failed gagal", { error: errorCode(e) }));
    await expireOrphanCharge(provider, trx.id, paymentId, created.providerRef, "activation_failed", plog);
    if (isUniqueViolation(error)) {
      plog.warn("payment aktif lain sudah ada (constraint satu-aktif)");
      return fail("in_progress", MSG.inProgress);
    }
    plog.error("aktivasi payment gagal", { error: errorCode(error) });
    return fail("error", MSG.generic);
  }

  plog.info("payment dibuat", { providerRef: created.providerRef, replaced: active?.id ?? null });
  await deps.enqueuePaymentPending(
    { event: "payment.pending", transactionId: trx.id, paymentId },
    plog,
  );
  return { ok: true, code: trx.code, reused: false, paymentId };
}

// ---------------------------------------------------------------------------------------------
// Halaman instruksi / berhasil / menunggu & endpoint status (P12, T-21). Hanya MEMBACA DB —
// tidak memanggil provider dan tidak mengubah status apa pun (BR-18).

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Skema deeplink e-wallet yang boleh dijadikan href (bukan javascript:/data:). */
const SAFE_PAYMENT_URL = /^(https:\/\/|gojek:\/\/|shopeeid:\/\/)/i;

export type PaymentDisplayStatus = "pending" | "paid" | "expired" | "failed" | "cancelled";

/** Data dinamis instruksi yang aman untuk client (tanpa raw provider/QR image URL). */
export interface PaymentDetails {
  kind: "virtual_account" | "qr" | "redirect" | "payment_code";
  bankName: string | null;
  vaNumber: string | null;
  billerCode: string | null;
  billKey: string | null;
  qrString: string | null;
  paymentUrl: string | null;
}

/** DTO halaman transaksi — tanpa email/telepon/nama donatur dan tanpa id internal. */
export interface TransactionView {
  transaction: {
    code: string;
    amount: bigint;
    status: string;
    campaignTitle: string;
    campaignSlug: string;
    createdAt: Date;
    paidAt: Date | null;
  };
  payment: {
    status: PaymentDisplayStatus;
    methodName: string;
    methodType: MethodRow["type"];
    expiresAt: Date | null;
    details: PaymentDetails | null;
    steps: InstructionSection[];
  } | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function toDetails(raw: unknown): PaymentDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const kind = i.kind;
  if (kind !== "virtual_account" && kind !== "qr" && kind !== "redirect" && kind !== "payment_code") return null;
  const url = str(i.paymentUrl);
  return {
    kind,
    bankName: str(i.bankName),
    vaNumber: str(i.vaNumber),
    billerCode: str(i.billerCode),
    billKey: str(i.billKey) ?? str(i.paymentCode),
    qrString: str(i.qrString),
    paymentUrl: url && SAFE_PAYMENT_URL.test(url) ? url : null,
  };
}

function displayStatus(trxStatus: string, paymentStatus: string, expiresAt: Date | null, now: Date): PaymentDisplayStatus {
  if (trxStatus === "paid" || paymentStatus === "paid") return "paid";
  if (paymentStatus === "pending") return expiresAt && expiresAt <= now ? "expired" : "pending";
  if (paymentStatus === "expired" || paymentStatus === "failed" || paymentStatus === "cancelled") return paymentStatus;
  return "failed";
}

/** Data halaman /transaksi/[code]/*; null = 404 (token salah/kedaluwarsa). */
export async function getTransactionView(code: string, token: string, now = new Date()): Promise<TransactionView | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const trx = await findPayableTransaction(code, sha256(token), now);
  if (!trx) return null;
  const p = await findPaymentForView(trx.id);
  let payment: TransactionView["payment"] = null;
  if (p) {
    const details = toDetails(p.instruction);
    const vars = {
      va_number: (details?.kind === "payment_code" ? details.billKey : details?.vaNumber) ?? undefined,
      bank_name: details?.bankName ?? undefined,
      amount: formatRupiah(trx.amount),
    };
    payment = {
      status: displayStatus(trx.status, p.status, p.expiresAt, now),
      methodName: p.methodName,
      methodType: p.methodType,
      expiresAt: p.expiresAt,
      details,
      steps: renderInstructionSections(p.instructions, vars),
    };
  }
  return {
    transaction: {
      code: trx.code,
      amount: trx.amount,
      status: trx.status,
      campaignTitle: trx.campaignTitle,
      campaignSlug: trx.campaignSlug,
      createdAt: trx.createdAt,
      paidAt: trx.paidAt,
    },
    payment,
  };
}

/** Endpoint polling: {status, paidAt} dari DB saja; null = 404. */
export async function getTransactionStatus(
  code: string,
  token: string,
  now = new Date(),
): Promise<{ status: string; paidAt: string | null } | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await findTransactionStatus(code, sha256(token), now);
  if (!row) return null;
  return { status: row.status, paidAt: row.paidAt ? row.paidAt.toISOString() : null };
}

/**
 * Charge baru sudah dibuat di provider tetapi tidak diaktifkan → expire. Bila expire gagal,
 * charge masih hidup (yatim): log error + audit `payment.orphan_charge` agar rekonsiliasi (P14)
 * / alert (P16) menindaklanjuti. Baris payment tetap `failed` dengan provider_ref terisi.
 */
async function expireOrphanCharge(
  provider: PaymentProvider,
  transactionId: string,
  paymentId: string,
  providerRef: string,
  cause: string,
  log: Logger,
): Promise<void> {
  try {
    await provider.expirePayment({ providerRef, orderId: paymentId });
  } catch (error) {
    log.error("expire charge yatim gagal; charge masih aktif di provider", {
      paymentId,
      providerRef,
      cause,
      error: errorCode(error),
    });
    await recordOrphanCharge({ transactionId, paymentId, providerRef, cause, error: errorCode(error) }).catch(
      (e: unknown) => log.error("audit payment.orphan_charge gagal", { paymentId, error: errorCode(e) }),
    );
  }
}
