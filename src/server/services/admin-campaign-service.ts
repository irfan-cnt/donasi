import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { hasPermission, type Permission } from "@/lib/admin-auth/permissions";
import { buildAuditRow } from "@/lib/audit/audit-row";
import {
  canDeletePermanently,
  canTransition,
  CAMPAIGN_STATUS_LABEL,
  publishBlockers,
  type CampaignStatusCode,
} from "@/lib/campaign-rules";
import { getDb, getTxDb } from "@/lib/db";
import {
  auditLogs,
  campaignAmountOptions,
  campaignDisbursements,
  campaignImages,
  campaignNews,
  campaigns,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { logger } from "@/lib/logger";
import { formatRupiah } from "@/lib/money";
import { sanitizeRichText } from "@/lib/sanitize";
import { isManagedImageUrl } from "@/lib/storage/image-storage";
import {
  campaignInputSchema,
  campaignStatusTarget,
  disbursementInputSchema,
  newsInputSchema,
  wibEndOfDay,
  wibStartOfDay,
  type CampaignInput,
} from "@/lib/validation/admin-campaign";
import {
  countCampaignTransactions,
  findCampaignById,
  findCampaignImages,
  findCampaignOptions,
  findNewsById,
  newsSlugTaken,
  slugTaken,
  usedAmountOptionIds,
  type CampaignRow,
  type NewsRow,
} from "@/server/repositories/admin-campaign-repository";
import { invalidateCampaignCaches } from "./campaign-cache";
import { safeError } from "@/lib/safe-error";

// Admin campaign, berita, penyaluran dana (P21; F-24, F-25, BR-01–BR-07, BR-40, BR-43).
// Setiap mutasi: cek permission (pertahanan berlapis selain requireAdmin di action), Zod,
// satu transaksi DB bersama baris audit (diff), lalu revalidateTag.

export interface AdminActor {
  adminId: string;
  permissions: readonly string[];
  ip: string | null;
  ua: string | null;
}

export class AdminForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Tidak punya izin ${permission}`);
  }
}

export type FieldErrors = Record<string, string>;
export type MutationResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: FieldErrors };

function assertPerm(actor: AdminActor, perm: Permission): void {
  if (!hasPermission(actor.permissions, perm)) throw new AdminForbiddenError(perm);
}

function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

type Failure = { ok: false; error: string; fieldErrors?: FieldErrors };
const invalid = (error: z.ZodError): Failure => ({
  ok: false,
  error: "Periksa kembali isian yang ditandai.",
  fieldErrors: fieldErrorsOf(error),
});

function pgCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Nilai JSON-aman untuk audit (bigint → string, Date → ISO). */
function jsonSafe(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === "bigint" ? v.toString() : v instanceof Date ? v.toISOString() : v,
    ]),
  );
}

function campaignSnapshot(
  c: CampaignRow,
  extra: { suggestions?: bigint[]; packages?: unknown[]; gallery?: unknown[] } = {},
) {
  return jsonSafe({
    title: c.title,
    slug: c.slug,
    status: c.status,
    categoryId: c.categoryId,
    shortDescription: c.shortDescription,
    descriptionHtml: c.descriptionHtml,
    featuredImageUrl: c.featuredImageUrl,
    featuredImageAlt: c.featuredImageAlt,
    amountType: c.amountType,
    minAmount: c.minAmount,
    maxAmount: c.maxAmount,
    targetAmount: c.targetAmount,
    startAt: c.startAt,
    endAt: c.endAt,
    isFeatured: c.isFeatured,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    publishedAt: c.publishedAt,
    ...(extra.suggestions ? { suggestions: extra.suggestions.map(String) } : {}),
    ...(extra.packages ? { packages: extra.packages } : {}),
    ...(extra.gallery ? { gallery: extra.gallery } : {}),
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof getTxDb>["transaction"]>[0]>[0];

async function audit(
  tx: Tx,
  actor: AdminActor,
  action: string,
  entityType: string,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  metadata?: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values(
    buildAuditRow({
      actor: { type: "admin", id: actor.adminId },
      action,
      entityType,
      entityId,
      before,
      after,
      metadata: metadata ?? null,
      ip: actor.ip,
      ua: actor.ua,
    }),
  );
}

const packageAudit = (rows: { label: string | null; amount: bigint; isActive: boolean }[]) =>
  rows.map((p) => `${p.label ?? ""}:${p.amount}:${p.isActive ? "aktif" : "nonaktif"}`);

// ============================== Campaign ==============================

export interface SaveCampaignOptions {
  /** "Simpan & Terbitkan" — butuh campaigns.publish. */
  publish?: boolean;
}

/**
 * Buat (id = null) atau ubah campaign beserta galeri & opsi nominal. Deskripsi disanitasi saat
 * simpan (whitelist yang sama dengan render). Campaign yang sudah tayang tetap wajib lolos BR-02.
 */
export async function saveCampaign(
  actor: AdminActor,
  id: string | null,
  raw: unknown,
  opts: SaveCampaignOptions = {},
): Promise<MutationResult<{ id: string; slug: string; warning?: string }>> {
  assertPerm(actor, "campaigns.write");
  if (opts.publish) assertPerm(actor, "campaigns.publish");

  const parsed = campaignInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input: CampaignInput = { ...parsed.data, descriptionHtml: sanitizeRichText(parsed.data.descriptionHtml) };

  const existing = id ? await findCampaignById(id) : undefined;
  if (id && !existing) return { ok: false, error: "Campaign tidak ditemukan." };
  if (existing?.status === "archived") return { ok: false, error: "Campaign yang diarsipkan tidak bisa diubah." };
  // OD-20: editor (campaigns.write) boleh mengubah konten campaign tayang/dijeda; status tetap butuh
  // campaigns.publish (opts.publish / changeCampaignStatus). Setiap perubahan diaudit dengan diff.
  // H1: Program Pilihan (hero beranda) hanya dari pemegang campaigns.publish.
  if (!hasPermission(actor.permissions, "campaigns.publish")) input.isFeatured = existing?.isFeatured ?? false;
  // H1: slug terkunci setelah campaign pernah terbit (URL publik, tautan berbagi, kuitansi).
  if (existing?.publishedAt && input.slug !== existing.slug) {
    return {
      ok: false,
      error: "Slug tidak bisa diubah setelah campaign pernah terbit.",
      fieldErrors: { slug: "Slug terkunci setelah campaign pernah terbit" },
    };
  }

  if (await slugTaken(input.slug, existing?.id)) {
    return { ok: false, error: "Slug sudah dipakai.", fieldErrors: { slug: "Slug sudah dipakai campaign lain" } };
  }

  const [oldOptions, oldImages] = existing
    ? await Promise.all([findCampaignOptions(existing.id), findCampaignImages(existing.id)])
    : [[], []];
  const knownUrls = [
    ...(existing?.featuredImageUrl ? [existing.featuredImageUrl] : []),
    ...oldImages.map((i) => i.url),
  ];
  const badImage =
    (input.featuredImageUrl && !isManagedImageUrl(input.featuredImageUrl, knownUrls)) ||
    input.gallery.some((g) => !isManagedImageUrl(g.url, knownUrls));
  if (badImage) return { ok: false, error: "Gambar harus diunggah melalui formulir ini." };

  const oldPackages = oldOptions.filter((o) => o.kind === "package");
  const oldSuggested = oldOptions.filter((o) => o.kind === "suggested");
  const oldPackageIds = new Set(oldPackages.map((p) => p.id));
  if (input.packages.some((p) => p.id && !oldPackageIds.has(p.id))) {
    return { ok: false, error: "Paket tidak valid untuk campaign ini." };
  }
  const keptIds = new Set(input.packages.flatMap((p) => (p.id ? [p.id] : [])));
  const removedPackages = oldPackages.filter((p) => !keptIds.has(p.id));
  const used = await usedAmountOptionIds([...removedPackages.map((p) => p.id), ...oldSuggested.map((s) => s.id)]);
  const blocked = removedPackages.filter((p) => used.has(p.id));
  if (blocked.length) {
    return {
      ok: false,
      error: `Paket "${blocked[0]!.label ?? formatRupiah(blocked[0]!.amount)}" sudah dipakai transaksi dan tidak bisa dihapus — nonaktifkan saja.`,
      fieldErrors: { packages: "Paket yang sudah dipakai transaksi tidak bisa dihapus" },
    };
  }

  const targetStatus: CampaignStatusCode = opts.publish ? "published" : (existing?.status ?? "draft");
  if (opts.publish && existing && existing.status !== "published" && !canTransition(existing.status, "published")) {
    return { ok: false, error: `Campaign berstatus ${CAMPAIGN_STATUS_LABEL[existing.status]} tidak bisa diterbitkan.` };
  }
  if (targetStatus !== "draft") {
    const blockers = publishBlockers(input);
    if (blockers.length) {
      return {
        ok: false,
        error: opts.publish ? "Campaign belum bisa diterbitkan." : "Campaign yang tayang harus tetap lengkap.",
        fieldErrors: { publish: blockers.join(" ") },
      };
    }
  }

  // AC-24.2: open → fixed saat ada transaksi pending → peringatan (transaksi lama tetap).
  let warning: string | undefined;
  if (existing && existing.amountType === "open" && input.amountType === "fixed") {
    const { pending } = await countCampaignTransactions(existing.id);
    if (pending > 0) {
      warning = `Ada ${pending} transaksi menunggu pembayaran dengan nominal bebas; transaksi tersebut tidak terpengaruh.`;
    }
  }

  const campaignId = existing?.id ?? newId();
  const now = new Date();
  const values = {
    title: input.title,
    slug: input.slug,
    categoryId: input.categoryId,
    shortDescription: input.shortDescription,
    descriptionHtml: input.descriptionHtml,
    featuredImageUrl: input.featuredImageUrl,
    featuredImageAlt: input.featuredImageUrl ? input.featuredImageAlt : null,
    amountType: input.amountType,
    minAmount: input.minAmount,
    maxAmount: input.maxAmount,
    targetAmount: input.targetAmount,
    startAt: input.startDate ? wibStartOfDay(input.startDate) : null,
    endAt: input.endDate ? wibEndOfDay(input.endDate) : null,
    isFeatured: input.isFeatured,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    status: targetStatus,
    publishedAt: targetStatus === "published" ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null),
    updatedBy: actor.adminId,
    updatedAt: now,
  };

  try {
    const saved = await getTxDb().transaction(async (tx) => {
      let row: CampaignRow;
      if (existing) {
        [row] = (await tx.update(campaigns).set(values).where(eq(campaigns.id, campaignId)).returning()) as [CampaignRow];
      } else {
        [row] = (await tx
          .insert(campaigns)
          .values({ ...values, id: campaignId, createdBy: actor.adminId })
          .returning()) as [CampaignRow];
      }

      // Paket: hapus yang dibuang (sudah dicek tidak dipakai), ubah yang ada, tambah yang baru.
      if (removedPackages.length) {
        await tx.delete(campaignAmountOptions).where(inArray(campaignAmountOptions.id, removedPackages.map((p) => p.id)));
      }
      for (const [i, p] of input.packages.entries()) {
        const data = { label: p.label, amount: p.amount, description: p.description, isActive: p.isActive, sortOrder: i };
        if (p.id) {
          await tx.update(campaignAmountOptions).set({ ...data, updatedAt: now }).where(eq(campaignAmountOptions.id, p.id));
        } else {
          await tx.insert(campaignAmountOptions).values({ ...data, campaignId, kind: "package" });
        }
      }

      // Saran nominal: sinkron per nominal; yang dibuang tapi pernah dipakai → nonaktif.
      const wanted = input.suggestions.map(String);
      for (const s of oldSuggested.filter((o) => !wanted.includes(String(o.amount)))) {
        if (used.has(s.id)) {
          await tx.update(campaignAmountOptions).set({ isActive: false, updatedAt: now }).where(eq(campaignAmountOptions.id, s.id));
        } else {
          await tx.delete(campaignAmountOptions).where(eq(campaignAmountOptions.id, s.id));
        }
      }
      for (const [i, amount] of input.suggestions.entries()) {
        await tx
          .insert(campaignAmountOptions)
          .values({ campaignId, kind: "suggested", amount, sortOrder: i, isActive: true })
          .onConflictDoUpdate({
            target: [campaignAmountOptions.campaignId, campaignAmountOptions.kind, campaignAmountOptions.amount],
            set: { sortOrder: i, isActive: true, updatedAt: now },
          });
      }

      // Galeri: ganti seluruhnya (tanpa FK masuk).
      await tx.delete(campaignImages).where(eq(campaignImages.campaignId, campaignId));
      if (input.gallery.length) {
        await tx.insert(campaignImages).values(
          input.gallery.map((g, i) => ({
            campaignId,
            url: g.url,
            alt: g.alt,
            width: g.width ?? null,
            height: g.height ?? null,
            sortOrder: i,
          })),
        );
      }

      const galleryAudit = (list: { url: string; alt: string }[]) => list.map((g) => `${g.url} | ${g.alt}`);
      await audit(
        tx,
        actor,
        existing ? (opts.publish && existing.status === "draft" ? "campaign.publish" : "campaign.update") : opts.publish ? "campaign.publish" : "campaign.create",
        "campaign",
        campaignId,
        existing
          ? campaignSnapshot(existing, {
              suggestions: oldSuggested.filter((s) => s.isActive).map((s) => s.amount),
              packages: packageAudit(oldPackages),
              gallery: galleryAudit(oldImages),
            })
          : null,
        campaignSnapshot(row, {
          suggestions: input.suggestions,
          packages: packageAudit(input.packages),
          gallery: galleryAudit(input.gallery),
        }),
      );
      return row;
    });
    await invalidateCampaignCaches(existing?.slug, saved.slug);
    return { ok: true, id: saved.id, slug: saved.slug, ...(warning ? { warning } : {}) };
  } catch (err) {
    const code = pgCode(err);
    if (code === "23505") {
      return { ok: false, error: "Data bentrok: slug atau nominal paket/saran sudah dipakai.", fieldErrors: { slug: "Periksa slug & nominal" } };
    }
    if (code === "23514") return { ok: false, error: "Data tidak memenuhi aturan campaign (cek gambar utama, nominal, jadwal)." };
    logger.error("admin: simpan campaign gagal", { error: safeError(err) });
    throw err;
  }
}

/** Ubah status (publish/pause/complete/archive) — BR-01 & BR-02, permission campaigns.publish. */
export async function changeCampaignStatus(
  actor: AdminActor,
  id: string,
  rawTo: unknown,
): Promise<MutationResult<{ status: CampaignStatusCode }>> {
  assertPerm(actor, "campaigns.publish");
  const to = campaignStatusTarget.safeParse(rawTo);
  if (!to.success) return { ok: false, error: "Status tidak valid." };
  const c = await findCampaignById(id);
  if (!c) return { ok: false, error: "Campaign tidak ditemukan." };
  if (!canTransition(c.status, to.data)) {
    return {
      ok: false,
      error: `Status ${CAMPAIGN_STATUS_LABEL[c.status]} tidak bisa diubah ke ${CAMPAIGN_STATUS_LABEL[to.data]}.`,
    };
  }
  if (to.data === "published") {
    const options = await findCampaignOptions(id);
    const blockers = publishBlockers({
      ...c,
      suggestions: options.filter((o) => o.kind === "suggested" && o.isActive).map((o) => o.amount),
      packages: options.filter((o) => o.kind === "package"),
    });
    if (blockers.length) {
      return { ok: false, error: "Campaign belum bisa diterbitkan.", fieldErrors: { publish: blockers.join(" ") } };
    }
  }
  const now = new Date();
  const applied = await getTxDb().transaction(async (tx) => {
    const updated = await tx
      .update(campaigns)
      .set({
        status: to.data,
        publishedAt: to.data === "published" ? (c.publishedAt ?? now) : c.publishedAt,
        // Arsip tidak boleh tetap jadi Program Pilihan.
        isFeatured: to.data === "archived" ? false : c.isFeatured,
        updatedBy: actor.adminId,
        updatedAt: now,
      })
      // P25: guard status lama — transisi dihitung dari status yang dibaca (cegah race).
      .where(and(eq(campaigns.id, id), eq(campaigns.status, c.status)))
      .returning({ id: campaigns.id });
    if (updated.length !== 1) return false;
    const before = { status: c.status, isFeatured: c.isFeatured };
    const after = { status: to.data, isFeatured: to.data === "archived" ? false : c.isFeatured };
    await audit(tx, actor, `campaign.${to.data === "published" ? "publish" : to.data === "paused" ? "pause" : to.data === "completed" ? "complete" : "archive"}`, "campaign", id, before, after);
    return true;
  });
  if (!applied) return { ok: false, error: "Status campaign sudah berubah. Muat ulang halaman." };
  await invalidateCampaignCaches(c.slug);
  return { ok: true, status: to.data };
}

/** Hapus permanen hanya draft tanpa transaksi (AC-24.1); selain itu selesaikan lalu arsipkan (OD-30). */
export async function deleteCampaign(actor: AdminActor, id: string): Promise<MutationResult> {
  assertPerm(actor, "campaigns.write");
  const c = await findCampaignById(id);
  if (!c) return { ok: false, error: "Campaign tidak ditemukan." };
  const { total } = await countCampaignTransactions(id);
  if (!canDeletePermanently(c.status, total)) {
    return {
      ok: false,
      error: total > 0
        ? "Campaign sudah punya transaksi sehingga tidak bisa dihapus permanen — selesaikan lalu arsipkan."
        : "Hanya campaign berstatus draf yang bisa dihapus permanen — selesaikan lalu arsipkan.",
    };
  }
  const [disb] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(campaignDisbursements)
    .where(eq(campaignDisbursements.campaignId, id));
  if ((disb?.n ?? 0) > 0) return { ok: false, error: "Campaign punya catatan penyaluran — selesaikan lalu arsipkan." };
  // L3: kunci baris campaign & hitung ulang transaksi DI DALAM transaksi DB (cegah race checkout).
  const deleted = await getTxDb().transaction(async (tx) => {
    const locked = await tx.execute(sql`select status from campaigns where id = ${id} for update`);
    const trxNow = await tx.execute(sql`select count(*)::int as n from transactions where campaign_id = ${id}`);
    const status = (locked.rows[0] as { status?: string } | undefined)?.status;
    if (status !== "draft" || (trxNow.rows[0] as { n: number }).n > 0) return false;
    await tx.delete(campaignNews).where(eq(campaignNews.campaignId, id));
    await tx.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.status, "draft")));
    await audit(tx, actor, "campaign.delete", "campaign", id, campaignSnapshot(c), null);
    return true;
  });
  if (!deleted) return { ok: false, error: "Campaign sudah berubah atau punya transaksi — selesaikan lalu arsipkan." };
  await invalidateCampaignCaches(c.slug);
  return { ok: true };
}

// ============================== Berita ==============================

function newsSnapshot(n: NewsRow) {
  return jsonSafe({
    campaignId: n.campaignId,
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    contentHtml: n.contentHtml,
    featuredImageUrl: n.featuredImageUrl,
    featuredImageAlt: n.featuredImageAlt,
    status: n.status,
    publishedAt: n.publishedAt,
    seoTitle: n.seoTitle,
    seoDescription: n.seoDescription,
    deletedAt: n.deletedAt,
  });
}

/** Simpan berita (draf) atau simpan & terbitkan (published_at diisi, AC-25.1). */
export async function saveNews(
  actor: AdminActor,
  id: string | null,
  raw: unknown,
  opts: { publish?: boolean } = {},
): Promise<MutationResult<{ id: string }>> {
  assertPerm(actor, "news.write");
  if (opts.publish) assertPerm(actor, "news.publish");
  const parsed = newsInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = { ...parsed.data, contentHtml: sanitizeRichText(parsed.data.contentHtml) };

  const existing = id ? await findNewsById(id) : undefined;
  if (id && !existing) return { ok: false, error: "Berita tidak ditemukan." };
  // Berita yang sudah terbit hanya boleh diubah oleh pemegang news.publish (perubahan langsung tayang).
  if (existing?.status === "published") assertPerm(actor, "news.publish");
  const campaign = await findCampaignById(input.campaignId);
  if (!campaign || campaign.status === "archived") {
    return { ok: false, error: "Campaign tidak valid.", fieldErrors: { campaignId: "Pilih campaign aktif" } };
  }
  if (await newsSlugTaken(input.campaignId, input.slug, existing?.id)) {
    return { ok: false, error: "Slug sudah dipakai.", fieldErrors: { slug: "Slug sudah dipakai berita lain di campaign ini" } };
  }
  const known = existing?.featuredImageUrl ? [existing.featuredImageUrl] : [];
  if (input.featuredImageUrl && !isManagedImageUrl(input.featuredImageUrl, known)) {
    return { ok: false, error: "Gambar harus diunggah melalui formulir ini." };
  }
  const status = opts.publish || existing?.status === "published" ? "published" : "draft";
  if (status === "published" && !input.contentHtml.replace(/<[^>]*>/g, "").trim()) {
    return { ok: false, error: "Konten wajib diisi sebelum terbit.", fieldErrors: { contentHtml: "Konten wajib diisi" } };
  }
  const now = new Date();
  const newsId = existing?.id ?? newId();
  const values = {
    campaignId: input.campaignId,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    contentHtml: input.contentHtml,
    featuredImageUrl: input.featuredImageUrl,
    featuredImageAlt: input.featuredImageUrl ? input.featuredImageAlt : null,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    status: status as "draft" | "published",
    publishedAt: status === "published" ? (existing?.publishedAt ?? now) : null,
    updatedAt: now,
  };
  try {
    const row = await getTxDb().transaction(async (tx) => {
      const [saved] = existing
        ? await tx.update(campaignNews).set(values).where(eq(campaignNews.id, newsId)).returning()
        : await tx.insert(campaignNews).values({ ...values, id: newsId, createdBy: actor.adminId }).returning();
      const action = !existing
        ? opts.publish ? "news.publish" : "news.create"
        : opts.publish && existing.status === "draft" ? "news.publish" : "news.update";
      await audit(tx, actor, action, "campaign_news", newsId, existing ? newsSnapshot(existing) : null, newsSnapshot(saved!));
      return saved!;
    });
    const oldSlug = existing && existing.campaignId !== row.campaignId ? (await findCampaignById(existing.campaignId))?.slug : null;
    await invalidateCampaignCaches(campaign.slug, oldSlug);
    return { ok: true, id: row.id };
  } catch (err) {
    if (pgCode(err) === "23505") {
      return { ok: false, error: "Slug sudah dipakai.", fieldErrors: { slug: "Slug sudah dipakai berita lain di campaign ini" } };
    }
    logger.error("admin: simpan berita gagal", { error: safeError(err) });
    throw err;
  }
}

/** Tarik berita terbit kembali ke draf (news.publish). */
export async function unpublishNews(actor: AdminActor, id: string): Promise<MutationResult> {
  assertPerm(actor, "news.publish");
  const n = await findNewsById(id);
  if (!n) return { ok: false, error: "Berita tidak ditemukan." };
  if (n.status !== "published") return { ok: false, error: "Berita belum terbit." };
  await getTxDb().transaction(async (tx) => {
    await tx.update(campaignNews).set({ status: "draft", publishedAt: null, updatedAt: new Date() }).where(eq(campaignNews.id, id));
    await audit(tx, actor, "news.unpublish", "campaign_news", id, { status: "published" }, { status: "draft" });
  });
  await invalidateCampaignCaches((await findCampaignById(n.campaignId))?.slug);
  return { ok: true };
}

/** Soft delete berita. Berita terbit butuh news.publish (menurunkan konten publik). */
export async function deleteNews(actor: AdminActor, id: string): Promise<MutationResult> {
  assertPerm(actor, "news.write");
  const n = await findNewsById(id);
  if (!n) return { ok: false, error: "Berita tidak ditemukan." };
  if (n.status === "published") assertPerm(actor, "news.publish");
  const now = new Date();
  await getTxDb().transaction(async (tx) => {
    await tx.update(campaignNews).set({ deletedAt: now, updatedAt: now }).where(and(eq(campaignNews.id, id), isNull(campaignNews.deletedAt)));
    await audit(tx, actor, "news.delete", "campaign_news", id, { deletedAt: null }, { deletedAt: now.toISOString() });
  });
  await invalidateCampaignCaches((await findCampaignById(n.campaignId))?.slug);
  return { ok: true };
}

// ============================== Penyaluran (OD-06) ==============================

/** Tambah penyaluran dana (BR-43): total ≤ collected_amount, dicek di dalam transaksi DB. */
export async function addDisbursement(actor: AdminActor, raw: unknown): Promise<MutationResult<{ id: string }>> {
  assertPerm(actor, "disbursements.write");
  const parsed = disbursementInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const campaign = await findCampaignById(input.campaignId);
  if (!campaign) return { ok: false, error: "Campaign tidak ditemukan." };
  if (campaign.status === "draft") return { ok: false, error: "Campaign draf belum bisa dicatat penyalurannya." };
  if (input.newsId) {
    // M2: bukti harus berita TERBIT milik campaign yang sama (findNewsById sudah mengecualikan soft delete).
    const news = await findNewsById(input.newsId);
    if (!news || news.campaignId !== input.campaignId || news.status !== "published") {
      return { ok: false, error: "Berita bukti tidak valid.", fieldErrors: { newsId: "Pilih berita terbit dari campaign ini" } };
    }
  }
  const id = newId();
  const result = await getTxDb().transaction(async (tx) => {
    // Kunci baris campaign agar dua penyaluran paralel tidak melewati collected_amount.
    const locked = await tx.execute(sql`select collected_amount::text as collected from campaigns where id = ${input.campaignId} for update`);
    const collected = BigInt((locked.rows[0] as { collected: string }).collected);
    const [sum] = await tx
      .select({ total: sql<string>`coalesce(sum(${campaignDisbursements.amount}), 0)::text` })
      .from(campaignDisbursements)
      .where(and(eq(campaignDisbursements.campaignId, input.campaignId), isNull(campaignDisbursements.deletedAt)));
    const total = BigInt(sum?.total ?? "0");
    if (total + input.amount > collected) {
      return { ok: false as const, remaining: collected - total };
    }
    await tx.insert(campaignDisbursements).values({ id, ...input, createdBy: actor.adminId });
    await audit(tx, actor, "disbursement.create", "campaign_disbursement", id, null, jsonSafe({ ...input }));
    return { ok: true as const };
  });
  if (!result.ok) {
    const rem = result.remaining < 0n ? 0n : result.remaining;
    return {
      ok: false,
      error: `Total penyaluran melebihi dana terkumpul. Sisa yang bisa disalurkan ${formatRupiah(rem)}.`,
      fieldErrors: { amount: "Melebihi dana terkumpul" },
    };
  }
  await invalidateCampaignCaches(campaign.slug);
  return { ok: true, id };
}

/** Soft delete penyaluran (BR-43: tidak ada hard delete). */
export async function deleteDisbursement(actor: AdminActor, id: string): Promise<MutationResult> {
  assertPerm(actor, "disbursements.write");
  const [row] = await getDb()
    .select({ campaignId: campaignDisbursements.campaignId, amount: campaignDisbursements.amount })
    .from(campaignDisbursements)
    .where(and(eq(campaignDisbursements.id, id), isNull(campaignDisbursements.deletedAt)))
    .limit(1);
  if (!row) return { ok: false, error: "Penyaluran tidak ditemukan." };
  const now = new Date();
  await getTxDb().transaction(async (tx) => {
    await tx
      .update(campaignDisbursements)
      .set({ deletedAt: now, updatedBy: actor.adminId, updatedAt: now })
      .where(eq(campaignDisbursements.id, id));
    await audit(tx, actor, "disbursement.delete", "campaign_disbursement", id, { deletedAt: null }, { deletedAt: now.toISOString() }, { amount: row.amount.toString() });
  });
  await invalidateCampaignCaches((await findCampaignById(row.campaignId))?.slug);
  return { ok: true };
}
