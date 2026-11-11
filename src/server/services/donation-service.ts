import "server-only";
import { createHmac } from "node:crypto";
import { getEnv } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { toRupiah, type Rupiah } from "@/lib/money";
import { rateLimit } from "@/lib/redis";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import { normalizeSlug } from "@/lib/slug";
import { generateTransactionCode } from "@/lib/transaction-code";
import {
  ANONYMOUS_NAME,
  parseDonationInput,
  type AmountBounds,
  type DonationFieldErrors,
} from "@/lib/validation/donation";
import {
  findActivePackage,
  findCheckoutCampaign,
  findDonorById,
  findPlatformSetting,
  findTransactionByAccessToken,
  insertTransaction,
  listActiveAmountOptions,
  upsertGuestDonor,
  type AmountOptionRow,
  type CheckoutCampaignRow,
} from "@/server/repositories/checkout-repository";
import { safeError } from "@/lib/safe-error";

/** BR-08: batas absolut platform (juga CHECK transactions_amount_check). */
export const PLATFORM_HARD_MAX: Rupiah = 1_000_000_000n;
/** BR-06: default max_amount campaign bila kosong. */
export const DEFAULT_CAMPAIGN_MAX: Rupiah = 100_000_000n;
const ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // security.md §2: 7 hari
const RATE_LIMIT_IP = { limit: 10, window: "1 h" } as const;
const RATE_LIMIT_EMAIL = { limit: 5, window: "1 h" } as const;
/** P25 (OD-31): batas per nomor WA — mencegah checkout dipakai mengirim WA ke nomor korban. */
const RATE_LIMIT_PHONE = { limit: 5, window: "1 h" } as const;

/** BR-03: published AND (start_at NULL/≤ now) AND (end_at NULL/> now). */
export function acceptsDonations(
  c: Pick<CheckoutCampaignRow, "status" | "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  if (c.status !== "published") return false;
  if (c.startAt && c.startAt.getTime() > now.getTime()) return false;
  if (c.endAt && c.endAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Alasan campaign tidak menerima donasi (untuk UI), null bila menerima. */
export function notAcceptingReason(
  c: Pick<CheckoutCampaignRow, "status" | "startAt" | "endAt">,
  now: Date = new Date(),
): string | null {
  if (acceptsDonations(c, now)) return null;
  if (c.status === "paused") return "Donasi untuk program ini sedang dijeda.";
  if (c.status === "completed" || (c.endAt && c.endAt <= now)) return "Program ini sudah selesai.";
  return "Program ini belum dibuka untuk donasi.";
}

async function platformMaxAmount(log?: Logger): Promise<Rupiah> {
  try {
    const raw = await findPlatformSetting("platform.max_amount");
    if (typeof raw === "number" || typeof raw === "string") {
      const v = toRupiah(raw);
      if (v > 0n && v <= PLATFORM_HARD_MAX) return v;
    }
  } catch (error) {
    log?.warn("platform.max_amount tidak terbaca; pakai default", { error: safeError(error) });
  }
  return PLATFORM_HARD_MAX;
}

/** Rentang nominal efektif: [min campaign, min(max campaign ?? default, batas platform)]. */
export function effectiveBounds(c: Pick<CheckoutCampaignRow, "minAmount" | "maxAmount">, platformMax: Rupiah): AmountBounds {
  const max = c.maxAmount ?? DEFAULT_CAMPAIGN_MAX;
  return { min: c.minAmount, max: max < platformMax ? max : platformMax };
}

export interface CheckoutView {
  campaign: Pick<CheckoutCampaignRow, "id" | "slug" | "title" | "amountType" | "featuredImageUrl" | "featuredImageAlt">;
  bounds: AmountBounds;
  options: AmountOptionRow[];
  blockedReason: string | null;
}

/** Data halaman checkout; null = 404 (draft/archived/tidak ada). */
export async function getCheckoutView(rawSlug: string): Promise<CheckoutView | null> {
  const slug = normalizeSlug(rawSlug);
  if (!slug || slug !== rawSlug) return null;
  const c = await findCheckoutCampaign(slug);
  if (!c || c.status === "draft" || c.status === "archived") return null;
  const [options, platformMax] = await Promise.all([
    listActiveAmountOptions(c.id, c.amountType === "fixed" ? "package" : "suggested"),
    platformMaxAmount(),
  ]);
  const bounds = effectiveBounds(c, platformMax);
  return {
    campaign: c,
    bounds,
    options:
      c.amountType === "fixed"
        ? options
        : options.filter((o) => o.amount >= bounds.min && o.amount <= bounds.max).slice(0, 6),
    blockedReason: notAcceptingReason(c),
  };
}

export interface SessionDonor {
  donorId: string;
}

export interface CreateDonationContext {
  sessionDonor: SessionDonor | null;
  ip: string | null;
  userAgent: string | null;
  log: Logger;
  now?: Date;
}

export type CreateDonationResult =
  | { ok: true; slug: string; code: string; accessToken: string; transactionId: string }
  | {
      ok: false;
      status: 400 | 404 | 409 | 429 | 500;
      reason: "invalid" | "not_found" | "not_accepting" | "invalid_option" | "rate_limited" | "error";
      fieldErrors: DonationFieldErrors;
    };

const fail = (
  status: 400 | 404 | 409 | 429 | 500,
  reason: Extract<CreateDonationResult, { ok: false }>["reason"],
  fieldErrors: DonationFieldErrors = {},
): CreateDonationResult => ({ ok: false, status, reason, fieldErrors });

/** Hash IP dengan HMAC(AUTH_SECRET) — IP mentah tidak disimpan. */
function hashIp(ip: string): Buffer {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(`ip:${ip}`).digest();
}

/** Rate limit OD-15: fail-open + log bila Redis gagal. */
async function withinRateLimit(name: string, id: string, policy: { limit: number; window: "1 h" }, log: Logger) {
  try {
    const r = await rateLimit(name, id, policy.limit, policy.window);
    return r.success;
  } catch (error) {
    log.error("rate limit tidak tersedia; fail-open (OD-15)", { policy: name, error: safeError(error) });
    return true;
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const e = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const name = e?.constraint ?? e?.cause?.constraint ?? "";
  return code === "23505" && name.includes(constraint);
}

/**
 * createDonation (T-19, F-04). Tidak pernah mempercayai nominal dari client untuk fixed (BR-07),
 * mengecek BR-03, min/max campaign & platform (BR-06/08), rate limit, lalu membuat transaksi
 * `created` dengan snapshot (BR-12), kode TK (BR-10) dan access token (hash saja di DB).
 */
export async function createDonation(
  raw: Record<string, unknown>,
  ctx: CreateDonationContext,
): Promise<CreateDonationResult> {
  const now = ctx.now ?? new Date();
  const slug = typeof raw.slug === "string" ? normalizeSlug(raw.slug) : null;
  if (!slug) return fail(404, "not_found", { form: "Program tidak ditemukan." });

  const campaign = await findCheckoutCampaign(slug);
  if (!campaign || campaign.status === "draft" || campaign.status === "archived") {
    return fail(404, "not_found", { form: "Program tidak ditemukan." });
  }
  if (!acceptsDonations(campaign, now)) {
    return fail(409, "not_accepting", { form: notAcceptingReason(campaign, now) ?? "Program tidak menerima donasi." });
  }

  const sessionDonor = ctx.sessionDonor ? await findDonorById(ctx.sessionDonor.donorId) : undefined;
  // Donatur login: email SELALU dari sesi; input email diabaikan.
  const input = sessionDonor ? { ...raw, email: sessionDonor.email } : raw;

  const bounds = effectiveBounds(campaign, await platformMaxAmount(ctx.log));
  const parsed = parseDonationInput(input, { amountType: campaign.amountType, bounds });
  if (!parsed.ok) {
    if (parsed.honeypot) ctx.log.warn("checkout honeypot terisi", { slug });
    return fail(400, "invalid", parsed.fieldErrors);
  }
  const data = parsed.data;

  let amount: Rupiah;
  let amountOptionId: string | null = null;
  if (campaign.amountType === "fixed") {
    const option = await findActivePackage(campaign.id, data.optionId!);
    if (!option) {
      ctx.log.warn("checkout optionId tidak valid untuk campaign", { slug });
      return fail(400, "invalid_option", { optionId: "Paket tidak tersedia. Pilih paket lain." });
    }
    amount = option.amount; // BR-07: nominal dari DB
    amountOptionId = option.id;
  } else {
    amount = data.amount!;
  }
  if (amount < 1000n || amount > PLATFORM_HARD_MAX || amount > bounds.max) {
    return fail(400, "invalid", { amount: "Nominal di luar batas yang diizinkan." });
  }

  const email = data.email;
  const ipOk = ctx.ip ? await withinRateLimit("checkout-ip", ctx.ip, RATE_LIMIT_IP, ctx.log) : true;
  const emailOk = ipOk && (await withinRateLimit("checkout-email", email, RATE_LIMIT_EMAIL, ctx.log));
  const phoneOk =
    !emailOk || !data.phoneE164 ? true : await withinRateLimit("checkout-phone", data.phoneE164, RATE_LIMIT_PHONE, ctx.log);
  if (!ipOk || !emailOk || !phoneOk) {
    ctx.log.warn("checkout rate limit terlampaui", { by: !ipOk ? "ip" : !emailOk ? "email" : "phone" });
    return fail(429, "rate_limited", {
      form: "Terlalu banyak percobaan donasi. Silakan coba lagi dalam beberapa saat.",
    });
  }

  const displayName = data.name || ANONYMOUS_NAME;
  const donorId =
    sessionDonor?.id ??
    (await upsertGuestDonor({
      email,
      name: displayName,
      phoneE164: data.phoneE164,
      whatsappOptIn: data.waConsent,
    }));

  const accessToken = generateSessionToken();
  const base = {
    accessTokenHash: sha256(accessToken),
    accessTokenExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    campaignId: campaign.id,
    donorId,
    amountOptionId,
    amount,
    status: "created" as const,
    campaignTitleSnapshot: campaign.title,
    donorNameSnapshot: displayName,
    donorEmailSnapshot: email,
    donorPhoneSnapshot: data.phoneE164,
    isAnonymous: data.anonymous,
    prayer: data.prayer || null,
    whatsappOptIn: data.waConsent,
    // P25 (OD-31): tamu (tanpa sesi) → WA hanya setelah paid.
    checkoutAuthenticated: !!sessionDonor,
    ipHash: ctx.ip ? hashIp(ctx.ip) : null,
    userAgent: ctx.userAgent?.slice(0, 512) ?? null,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateTransactionCode(now);
    try {
      const row = await insertTransaction({ ...base, code });
      ctx.log.info("transaksi dibuat", { transactionId: row.id, code: row.code, amount });
      return { ok: true, slug: campaign.slug, code: row.code, accessToken, transactionId: row.id };
    } catch (error) {
      if (isUniqueViolation(error, "code")) continue; // tabrakan kode → coba kode baru
      ctx.log.error("insert transaksi gagal", { error: safeError(error) });
      return fail(500, "error");
    }
  }
  ctx.log.error("kode transaksi bertabrakan 3x");
  return fail(500, "error");
}

/** Ringkasan transaksi untuk halaman pembayaran — hanya dengan kode + token sah. */
export async function getTransactionByAccess(slug: string, code: string, token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await findTransactionByAccessToken(code, sha256(token), now);
  if (!row || row.campaignSlug !== slug) return null;
  return row;
}
