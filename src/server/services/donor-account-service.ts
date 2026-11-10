import "server-only";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import {
  DONOR_PAGE_SIZE,
  type DonorProfileInput,
  type DonorStatusFilter,
  type DonorTrxCursor,
} from "@/lib/validation/donor";
import { getCampaignPage, type CampaignCardData } from "@/server/queries/public-campaigns";
import {
  findDonorTransaction,
  findLatestCampaignNews,
  findLatestPayableTransaction,
  getDonorSummary,
  listDonorTransactionsPage,
  listDonorTransactionYears,
  listProcessedPaymentEvents,
  listRecentDonorTransactions,
  listTransactionPayments,
  reissueAccessToken,
  type TrxStatus,
} from "@/server/repositories/donor-dashboard-repository";
import {
  anonymizeDonorAccount,
  updateDonorProfile,
  upsertDonorForUser,
  type DonorRow,
} from "@/server/repositories/donor-repository";

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
 * Pastikan user login punya baris donor (F-09, AC-09.1) dan klaim transaksi tamu ber-email sama
 * (F-11, AC-11.x). Idempoten — aman dipanggil tiap login. Hanya dipanggil untuk email Google
 * terverifikasi (callback signIn menolak yang lain). Nama default = bagian lokal email.
 */
export async function ensureDonorAccount(user: unknown): Promise<DonorRow | undefined> {
  const parsed = userSchema.safeParse(user);
  if (!parsed.success) {
    logger.warn("donor-account: data user tidak valid", { issues: parsed.error.issues.length });
    return undefined;
  }
  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name?.trim() || email.split("@")[0]!;
  const { donor, claim } = await upsertDonorForUser({ userId: parsed.data.id, email, name });
  if (!donor) {
    // Email sudah tertaut ke user lain — jangan menimpa kepemilikan donor.
    logger.warn("donor-account: donor tidak dapat ditautkan", { userId: parsed.data.id });
  } else if (claim.linkedGuestDonor || claim.movedTransactions > 0) {
    logger.info("donor-account: transaksi tamu diklaim", { donorId: donor.id, ...claim });
  }
  return donor;
}

// ---------------------------------------------------------------------------------------------
// Dashboard donatur (P18: F-12, F-13, F-15). Semua fungsi menerima donorId DARI SESI.

export async function getDonorDashboard(donorId: string) {
  const [summary, recent, payable] = await Promise.all([
    getDonorSummary(donorId),
    listRecentDonorTransactions(donorId, 5),
    findLatestPayableTransaction(donorId),
  ]);
  return { summary, recent, payable: payable ?? null };
}

/** Rekomendasi: campaign published terbaru yang belum pernah didonasikan donor (maks 3). */
export async function getRecommendedCampaigns(excludeTitles: Set<string>): Promise<CampaignCardData[]> {
  const page = await getCampaignPage({ status: "published", limit: 9 });
  return page.items.filter((c) => !excludeTitles.has(c.title)).slice(0, 3);
}

export async function getDonorTransactionList(args: {
  donorId: string;
  status?: DonorStatusFilter;
  year?: number;
  after?: DonorTrxCursor | null;
  before?: DonorTrxCursor | null;
}) {
  const [page, years] = await Promise.all([
    listDonorTransactionsPage({ ...args, pageSize: DONOR_PAGE_SIZE }),
    listDonorTransactionYears(args.donorId),
  ]);
  return { ...page, years };
}

export interface TimelineStep {
  key: string;
  label: string;
  at: Date;
  tone: "done" | "success" | "warning" | "danger";
}

const OUTCOME: Partial<Record<TrxStatus, { label: string; tone: TimelineStep["tone"] }>> = {
  paid: { label: "Pembayaran diterima", tone: "success" },
  expired: { label: "Pembayaran kedaluwarsa", tone: "warning" },
  failed: { label: "Pembayaran gagal", tone: "danger" },
  cancelled: { label: "Pembayaran dibatalkan", tone: "warning" },
  refunded: { label: "Dana dikembalikan", tone: "warning" },
};

/**
 * Timeline status dari transaksi, payments & payment_events (hanya status/waktu, tanpa payload
 * provider). Murni — diuji unit.
 */
export function buildTimeline(input: {
  trx: { status: TrxStatus; createdAt: Date; paidAt: Date | null; updatedAt: Date; receiptNo: string | null; receiptIssuedAt: Date | null };
  payments: { id: string; status: TrxStatus; methodName: string; createdAt: Date; updatedAt: Date; paidAt: Date | null }[];
  events: { paymentId: string | null; statusReported: string | null; receivedAt: Date }[];
}): TimelineStep[] {
  const steps: TimelineStep[] = [{ key: "created", label: "Donasi dibuat", at: input.trx.createdAt, tone: "done" }];
  for (const p of input.payments) {
    steps.push({ key: `pending-${p.id}`, label: `Menunggu pembayaran · ${p.methodName}`, at: p.createdAt, tone: "done" });
    const outcome = p.status === "pending" ? undefined : OUTCOME[p.status];
    if (outcome) {
      // Waktu konfirmasi dari event provider terverifikasi bila ada.
      const event = input.events.find((e) => e.paymentId === p.id);
      const at = p.status === "paid" ? (p.paidAt ?? event?.receivedAt ?? p.updatedAt) : (event?.receivedAt ?? p.updatedAt);
      steps.push({ key: `${p.status}-${p.id}`, label: outcome.label, at, tone: outcome.tone });
    }
  }
  const hasPaid = input.payments.some((p) => p.status === "paid");
  if (input.trx.status === "paid" && !hasPaid && input.trx.paidAt) {
    steps.push({ key: "paid", label: "Pembayaran diterima", at: input.trx.paidAt, tone: "success" });
  }
  const trxOutcome = OUTCOME[input.trx.status];
  if (trxOutcome && input.trx.status !== "paid" && !input.payments.some((p) => p.status === input.trx.status)) {
    steps.push({ key: `trx-${input.trx.status}`, label: trxOutcome.label, at: input.trx.updatedAt, tone: trxOutcome.tone });
  }
  if (input.trx.receiptNo && input.trx.receiptIssuedAt) {
    steps.push({ key: "receipt", label: `Kuitansi ${input.trx.receiptNo} terbit`, at: input.trx.receiptIssuedAt, tone: "success" });
  }
  return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Detail transaksi milik donor; null = 404 (tidak ada ATAU milik orang lain). */
export async function getDonorTransactionDetail(donorId: string, code: string) {
  const trx = await findDonorTransaction(donorId, code);
  if (!trx) return null;
  const [pays, news] = await Promise.all([listTransactionPayments(trx.id), findLatestCampaignNews(trx.campaignId)]);
  const events = await listProcessedPaymentEvents(pays.map((p) => p.id));
  const active = pays.findLast((p) => p.status === "pending" || p.status === "paid") ?? pays.at(-1);
  return {
    trx,
    methodName: active?.methodName ?? null,
    timeline: buildTimeline({ trx, payments: pays, events }),
    news: news && trx.campaignStatus !== "draft" && trx.campaignStatus !== "archived" ? news : null,
  };
}

export async function saveDonorProfile(donorId: string, input: DonorProfileInput, meta: { ip: string | null; ua: string | null }) {
  await updateDonorProfile(donorId, input);
  // Audit tanpa nilai PII (nama/WA): hanya field preferensi + penanda perubahan.
  await writeAudit({
    actor: { type: "donor", id: donorId },
    action: "donor.profile_updated",
    entityType: "donor",
    entityId: donorId,
    metadata: { whatsappOptIn: input.whatsappOptIn, defaultAnonymous: input.defaultAnonymous, hasPhone: !!input.phoneE164 },
    ip: meta.ip,
    ua: meta.ua,
  });
}

export function deleteDonorAccount(args: { donorId: string; userId: string; ip: string | null; ua: string | null }) {
  return anonymizeDonorAccount(args);
}

const ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // sama dengan checkout (security.md §2)

/**
 * Lanjut bayar oleh PEMILIK yang login: access token hanya disimpan hash-nya, jadi token lama
 * tidak bisa dipulihkan → terbitkan token baru (tautan lama di email ikut tidak berlaku) dan
 * kembalikan URL halaman pembayaran. Tidak mengubah status apa pun (BR-18). null = 404.
 */
export async function continuePayment(donorId: string, code: string): Promise<string | null> {
  const token = generateSessionToken();
  const row = await reissueAccessToken({
    donorId,
    code,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
  });
  if (!row) return null;
  await writeAudit({
    actor: { type: "donor", id: donorId },
    action: "transaction.access_token_reissued",
    entityType: "transaction",
    entityId: row.id,
  });
  if (row.status === "created" && row.campaignSlug) {
    return `/donasi/${row.campaignSlug}/pembayaran?${new URLSearchParams({ trx: row.code, t: token })}`;
  }
  return `/transaksi/${row.code}/instruksi?${new URLSearchParams({ t: token })}`;
}
