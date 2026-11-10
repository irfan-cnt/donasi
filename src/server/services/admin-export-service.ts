import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasPermission, type Permission } from "@/lib/admin-auth/permissions";
import { writeAudit } from "@/lib/audit";
import { CSV_BOM, csvRow } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { signExportToken, type ExportKind } from "@/lib/exports/export-token";
import { looksLikePii, maskEmail, maskPhone } from "@/lib/format/mask";
import { safeError } from "@/lib/jobs/job-route";
import type { Logger } from "@/lib/logger";
import { publishJob } from "@/lib/qstash";
import { siteUrl } from "@/lib/site";
import { exportKey, getExportStore, type ExportStore } from "@/lib/storage/export-storage";
import {
  EXPORT_MAX_ROWS,
  EXPORT_SYNC_LIMIT,
  exportRequestSchema,
  type DonorFilter,
  type ExportRequest,
  type TransactionFilter,
} from "@/lib/validation/admin-finance";
import { findAdminById, loadAdminAccess } from "@/server/repositories/admin-repository";
import {
  countAdminDonors,
  countAdminTransactions,
  donorExportBatch,
  transactionExportBatch,
} from "@/server/repositories/admin-finance-repository";
import type { AdminActor } from "./admin-campaign-service";

// Ekspor CSV transaksi & donatur (P22; F-27, F-28, AC-27.2, AC-28.1). Mengikuti filter aktif
// (filter yang sama dengan daftar). ≤ 10.000 baris: streaming langsung. > 10.000: job QStash
// menulis berkas private ke storage lalu admin mengunduh lewat tautan bertanda tangan 1 jam.
// Setiap ekspor dicatat di audit log. PII transaksi dimasking bila admin tanpa donors.export.

export const EXPORT_PERMISSION: Record<ExportKind, Permission> = {
  transactions: "transactions.export",
  donors: "donors.export",
};
const BATCH = 1000;

const wib = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
/** "2026-11-10 14:05:09" (WIB). */
export const csvDate = (d: Date | null) => (d ? wib.format(d).replace(", ", " ") : "");

const STATUS_LABEL: Record<string, string> = {
  created: "Menunggu",
  pending: "Menunggu",
  paid: "Berhasil",
  expired: "Kedaluwarsa",
  failed: "Gagal",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};

export const TRANSACTION_CSV_HEADER = [
  "Kode",
  "Dibuat (WIB)",
  "Status",
  "Nominal",
  "Campaign",
  "Metode",
  "Provider",
  "Nama donatur",
  "Anonim",
  "Email",
  "WhatsApp",
  "Dibayar (WIB)",
  "No. kuitansi",
];
export const DONOR_CSV_HEADER = ["Nama", "Email", "WhatsApp", "Tipe", "Total donasi", "Transaksi berhasil", "Donasi terakhir (WIB)", "Terdaftar (WIB)"];

/** Potongan CSV (header + baris) sesuai filter. `mask` = sembunyikan email/WA (tanpa donors.export). */
export async function* csvChunks(
  req: ExportRequest,
  mask: boolean,
  stats: { rows: number } = { rows: 0 },
  maxRows = EXPORT_MAX_ROWS,
): AsyncGenerator<string> {
  yield CSV_BOM;
  let emitted = 0;
  if (req.kind === "transactions") {
    yield csvRow(TRANSACTION_CSV_HEADER);
    let cursor: { createdAt: string; id: string } | null = null;
    do {
      const batch = await transactionExportBatch(req.filters, mask, cursor, BATCH);
      let out = "";
      for (const t of batch.rows) {
        if (emitted >= maxRows) break;
        emitted += 1;
        stats.rows = emitted;
        out += csvRow([
          t.code,
          csvDate(t.createdAt),
          STATUS_LABEL[t.status] ?? t.status,
          t.amount,
          t.campaignTitle,
          t.methodName ?? "",
          t.providerCode ?? "",
          t.donorName,
          t.isAnonymous ? "Ya" : "Tidak",
          mask ? maskEmail(t.donorEmail) : t.donorEmail,
          t.donorPhone ? (mask ? maskPhone(t.donorPhone) : t.donorPhone) : "",
          csvDate(t.paidAt),
          t.receiptNo ?? "",
        ]);
      }
      if (out) yield out;
      cursor = emitted >= maxRows ? null : batch.cursor;
    } while (cursor);
    return;
  }
  yield csvRow(DONOR_CSV_HEADER);
  let cursor: string | null = null;
  do {
    const batch = await donorExportBatch(req.filters, mask, cursor, BATCH);
    let out = "";
    for (const d of batch.rows) {
      if (emitted >= maxRows) break;
      emitted += 1;
      stats.rows = emitted;
      out += csvRow([
        d.name,
        mask ? maskEmail(d.email) : d.email,
        d.phone ? (mask ? maskPhone(d.phone) : d.phone) : "",
        d.hasAccount ? "Akun" : "Tamu",
        d.totalPaid,
        d.paidCount,
        csvDate(d.lastPaidAt),
        csvDate(d.createdAt),
      ]);
    }
    if (out) yield out;
    cursor = emitted >= maxRows ? null : batch.cursor;
  } while (cursor);
}

export function csvStream(req: ExportRequest, mask: boolean): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const it = csvChunks(req, mask);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(enc.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await it.return(undefined);
    },
  });
}

export const exportFileName = (kind: ExportKind, now = new Date()) =>
  `${kind === "transactions" ? "transaksi" : "donatur"}-${csvDate(now).slice(0, 10)}.csv`;

/** Filter tanpa nilai kosong (untuk body job). */
function filterMeta(filters: TransactionFilter | DonorFilter): Record<string, unknown> {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
}

/** Filter untuk metadata AUDIT: kata kunci berbentuk email/WA tidak pernah disimpan (M2). */
export function auditFilterMeta(filters: TransactionFilter | DonorFilter): Record<string, unknown> {
  const meta = filterMeta(filters);
  if (typeof meta.q === "string" && looksLikePii(meta.q)) meta.q = "[pii]";
  return meta;
}

export interface ExportJobBody {
  exportId: string;
  adminId: string;
  kind: ExportKind;
  filters: Record<string, unknown>;
  /** Mask saat antre (terikat di token unduh). Job memasking bila ini true ATAU izin sudah dicabut. */
  masked: boolean;
}

export interface ExportDeps {
  store: ExportStore | null;
  publish: (body: ExportJobBody) => Promise<void>;
  now?: () => number;
  /** Ambang stream vs async (default EXPORT_SYNC_LIMIT; test memakai nilai kecil). */
  syncLimit?: number;
}

export function runtimeExportDeps(): ExportDeps {
  return {
    store: getExportStore(),
    publish: async (body) => {
      if (!getEnv().QSTASH_TOKEN) throw new ExportUnavailableError("QStash belum dikonfigurasi");
      await publishJob(`${siteUrl()}/api/jobs/export`, body, { deduplicationId: `export-${body.exportId}`, retries: 2 });
    },
  };
}

export class ExportUnavailableError extends Error {}

export type ExportStart =
  | { mode: "stream"; kind: ExportKind; rows: number; stream: ReadableStream<Uint8Array>; fileName: string }
  | { mode: "async"; kind: ExportKind; rows: number; exportId: string; token: string; expiresAt: Date }
  | { mode: "error"; status: 400 | 403 | 422 | 503; error: string };

/**
 * Mulai ekspor. Permission dicek di sini juga (pertahanan berlapis selain guard route).
 * Audit `transaction.export` / `donor.export` (metadata: filter, jumlah baris, mode).
 */
export async function startExport(actor: AdminActor, raw: unknown, deps: ExportDeps): Promise<ExportStart> {
  const parsed = exportRequestSchema.safeParse(raw);
  if (!parsed.success) return { mode: "error", status: 400, error: "Permintaan ekspor tidak valid." };
  const req = parsed.data;
  if (!hasPermission(actor.permissions, EXPORT_PERMISSION[req.kind])) {
    return { mode: "error", status: 403, error: "Anda tidak punya izin ekspor ini." };
  }
  const mask = !hasPermission(actor.permissions, "donors.export");
  const rows =
    req.kind === "transactions"
      ? await countAdminTransactions(req.filters, mask)
      : await countAdminDonors(req.filters, mask);
  const action = req.kind === "transactions" ? "transaction.export" : "donor.export";
  const audit = (metadata: Record<string, unknown>, entityId: string | null = null) =>
    writeAudit({
      actor: { type: "admin", id: actor.adminId },
      action,
      entityType: "export",
      entityId,
      metadata: { filters: auditFilterMeta(req.filters), rows, masked: mask, ...metadata },
      ip: actor.ip,
      ua: actor.ua,
    });

  if (rows <= (deps.syncLimit ?? EXPORT_SYNC_LIMIT)) {
    await audit({ mode: "stream" });
    return { mode: "stream", kind: req.kind, rows, stream: csvStream(req, mask), fileName: exportFileName(req.kind) };
  }
  if (rows > EXPORT_MAX_ROWS) {
    return {
      mode: "error",
      status: 422,
      error: `Hasil ${rows.toLocaleString("id-ID")} baris melebihi batas ${EXPORT_MAX_ROWS.toLocaleString("id-ID")}. Persempit filter (mis. rentang tanggal).`,
    };
  }
  if (!deps.store) {
    return {
      mode: "error",
      status: 503,
      error: `Ekspor di atas ${EXPORT_SYNC_LIMIT.toLocaleString("id-ID")} baris membutuhkan penyimpanan berkas yang belum dikonfigurasi di server ini. Persempit filter agar ≤ ${EXPORT_SYNC_LIMIT.toLocaleString("id-ID")} baris.`,
    };
  }
  const exportId = randomUUID();
  try {
    await deps.publish({ exportId, adminId: actor.adminId, kind: req.kind, filters: filterMeta(req.filters), masked: mask });
  } catch (error) {
    if (error instanceof ExportUnavailableError) {
      return { mode: "error", status: 503, error: "Antrean ekspor belum dikonfigurasi di server ini. Persempit filter agar ≤ 10.000 baris." };
    }
    throw error;
  }
  await audit({ mode: "async", status: "queued" }, exportId);
  const now = deps.now?.() ?? Date.now();
  const token = signExportToken({ kind: req.kind, masked: mask, exportId, adminId: actor.adminId }, getEnv().AUTH_SECRET, now);
  return { mode: "async", kind: req.kind, rows, exportId, token, expiresAt: new Date(now + 3_600_000) };
}

/**
 * Retensi berkas ekspor (PII): 2 jam (tautan berlaku 1 jam). Dihapus oleh job terjadwal
 * cancel-stale (tiap jam) lewat cleanupExportFiles → umur maksimum berkas < 3 jam.
 */
export const EXPORT_FILE_RETENTION_MS = 2 * 3_600_000;
/** Job ekspor tanpa hasil setelah ini dilaporkan gagal ke UI (I4). */
export const EXPORT_STALE_MS = 15 * 60_000;

/** Hapus berkas ekspor kedaluwarsa (semua halaman listing). Tidak melempar. */
export async function cleanupExportFiles(
  store: ExportStore | null,
  log: Logger,
  now: number = Date.now(),
): Promise<{ exportFilesRemoved: number; exportCleanup: "ok" | "skipped" | "error" }> {
  if (!store) return { exportFilesRemoved: 0, exportCleanup: "skipped" };
  try {
    const n = await store.deleteOlderThan("exports/", new Date(now - EXPORT_FILE_RETENTION_MS));
    return { exportFilesRemoved: n, exportCleanup: "ok" };
  } catch (error) {
    log.warn("export: pembersihan berkas lama gagal", { error: safeError(error) });
    return { exportFilesRemoved: 0, exportCleanup: "error" };
  }
}

/**
 * Job QStash `/api/jobs/export`: body sudah terverifikasi signature. Permission admin dicek ULANG
 * dari DB (izin bisa dicabut setelah antre). Tulis CSV ke storage private, audit selesai/gagal.
 */
export async function runExportJob(
  rawBody: unknown,
  deps: { store: ExportStore | null; log: Logger; now?: () => number },
): Promise<Record<string, unknown>> {
  const body = parseJobBody(rawBody);
  if (!body) return { skipped: "invalid_body" };
  const auditDone = (action: string, metadata: Record<string, unknown>) =>
    writeAudit({
      actor: { type: "system" },
      action,
      entityType: "export",
      entityId: body.exportId,
      metadata: { kind: body.kind, adminId: body.adminId, ...metadata },
    });
  if (!deps.store) {
    await auditDone("export.failed", { reason: "storage_unconfigured" });
    return { failed: "storage_unconfigured" };
  }
  const admin = await findAdminById(body.adminId);
  const access = admin && admin.status !== "disabled" ? await loadAdminAccess(body.adminId) : { permissions: [] };
  if (!hasPermission(access.permissions, EXPORT_PERMISSION[body.kind])) {
    await auditDone("export.failed", { reason: "permission_revoked" });
    return { failed: "permission_revoked" };
  }
  const req = exportRequestSchema.parse({ kind: body.kind, filters: body.filters });
  const mask = body.masked || !hasPermission(access.permissions, "donors.export");
  const parts: string[] = [];
  const stats = { rows: 0 };
  for await (const chunk of csvChunks(req, mask, stats)) parts.push(chunk);
  const data = Buffer.from(parts.join(""), "utf8");
  await deps.store.put(exportKey(body.kind, body.exportId), data);
  await auditDone("export.completed", { rows: stats.rows, bytes: data.length, masked: mask });
  return { rows: stats.rows };
}

function parseJobBody(raw: unknown): ExportJobBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (typeof b.exportId !== "string" || !uuid.test(b.exportId)) return null;
  if (typeof b.adminId !== "string" || !uuid.test(b.adminId)) return null;
  if (b.kind !== "transactions" && b.kind !== "donors") return null;
  const parsed = exportRequestSchema.safeParse({ kind: b.kind, filters: b.filters ?? {} });
  if (!parsed.success) return null;
  // Body tanpa `masked` (format lama) diperlakukan sebagai masked (fail-closed).
  return { exportId: b.exportId, adminId: b.adminId, kind: b.kind, filters: (b.filters ?? {}) as Record<string, unknown>, masked: b.masked !== false };
}

/** Status berkas async untuk admin pemiliknya: ready / failed / processing. */
export async function exportStatus(
  kind: ExportKind,
  exportId: string,
  store: ExportStore | null,
  now: number = Date.now(),
): Promise<"ready" | "failed" | "processing"> {
  if (store && (await store.exists(exportKey(kind, exportId)))) return "ready";
  const r = await getDb().execute(sql`SELECT
      EXISTS (SELECT 1 FROM audit_logs WHERE action = 'export.failed' AND entity_type = 'export' AND entity_id = ${exportId}) AS failed,
      (SELECT min(created_at) FROM audit_logs WHERE action IN ('transaction.export', 'donor.export')
        AND entity_type = 'export' AND entity_id = ${exportId}) AS queued_at`);
  const row = r.rows[0] as { failed?: boolean; queued_at?: string | null } | undefined;
  if (row?.failed) return "failed";
  // I4: job mati tanpa menulis export.failed → laporkan gagal setelah EXPORT_STALE_MS.
  if (row?.queued_at && now - new Date(String(row.queued_at)).getTime() > EXPORT_STALE_MS) return "failed";
  return "processing";
}
