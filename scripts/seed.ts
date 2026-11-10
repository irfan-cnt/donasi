// Seed idempoten: `pnpm db:seed` (= --reference) | `pnpm db:seed:sample` (referensi + contoh).
// Lihat docs/04-database/seed-data.md. Contoh ditolak bila APP_ENV=production.
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as s from "@/lib/db/schema";
import { assertSampleAllowed, parseSeedMode } from "./seed/cli";
import {
  CATEGORIES,
  NOTIFICATION_TEMPLATES,
  PAYMENT_METHODS,
  PERMISSIONS,
  PLATFORM_SETTINGS,
  PROVIDER,
  ROLE_PERMISSIONS,
  ROLES,
} from "./seed/reference-data";
import {
  SAMPLE_ANCHOR,
  SAMPLE_CAMPAIGNS,
  assignReceiptNumbers,
  buildSampleDonors,
  buildSampleNews,
  buildSampleTransactions,
} from "./seed/sample-data";

config({ path: ".env.local", quiet: true });

type Db = NeonDatabase<typeof s>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PLACEHOLDER_IMAGE = "/images/sample/placeholder.svg";

function chunk<T>(items: readonly T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Referensi: insert-if-missing agar perubahan admin (aktif/nonaktif, isi template) tidak ditimpa. */
async function seedReference(tx: Tx) {
  await tx
    .insert(s.campaignCategories)
    .values(CATEGORIES.map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 })))
    .onConflictDoNothing({ target: s.campaignCategories.slug });

  await tx
    .insert(s.roles)
    .values(ROLES.map((r) => ({ ...r, isSystem: true })))
    .onConflictDoUpdate({ target: s.roles.code, set: { isSystem: true } });

  await tx
    .insert(s.permissions)
    .values([...PERMISSIONS])
    .onConflictDoUpdate({
      target: s.permissions.code,
      set: { description: sql`excluded.description` },
    });

  const roleRows = await tx.select({ id: s.roles.id, code: s.roles.code }).from(s.roles);
  const roleId = new Map(roleRows.map((r) => [r.code, r.id]));
  await tx
    .insert(s.rolePermissions)
    .values(
      Object.entries(ROLE_PERMISSIONS).flatMap(([code, perms]) =>
        perms.map((permissionCode) => ({ roleId: roleId.get(code)!, permissionCode })),
      ),
    )
    .onConflictDoNothing();

  await tx.insert(s.paymentProviders).values(PROVIDER).onConflictDoNothing({
    target: s.paymentProviders.code,
  });
  const [provider] = await tx
    .select({ id: s.paymentProviders.id })
    .from(s.paymentProviders)
    .where(eq(s.paymentProviders.code, PROVIDER.code));

  await tx
    .insert(s.paymentMethods)
    .values(
      PAYMENT_METHODS.map((m, i) => ({
        ...m,
        providerId: provider!.id,
        isActive: false,
        displayOrder: (i + 1) * 10,
      })),
    )
    .onConflictDoNothing({ target: [s.paymentMethods.providerId, s.paymentMethods.code] });

  // Tidak ada unique (event, channel) untuk template non-aktif → cek keberadaan manual.
  const existing = await tx
    .select({ event: s.notificationTemplates.event, channel: s.notificationTemplates.channel })
    .from(s.notificationTemplates);
  const have = new Set(existing.map((t) => `${t.event}:${t.channel}`));
  const missing = NOTIFICATION_TEMPLATES.filter((t) => !have.has(`${t.event}:${t.channel}`));
  if (missing.length > 0) await tx.insert(s.notificationTemplates).values(missing);

  await tx.insert(s.platformSettings).values(PLATFORM_SETTINGS).onConflictDoNothing();
}

async function seedSample(tx: Tx) {
  const [provider] = await tx
    .select({ id: s.paymentProviders.id })
    .from(s.paymentProviders)
    .where(eq(s.paymentProviders.code, PROVIDER.code));
  const providerId = provider!.id;
  const methodRows = await tx
    .select({
      id: s.paymentMethods.id,
      code: s.paymentMethods.code,
      type: s.paymentMethods.type,
      providerChannel: s.paymentMethods.providerChannel,
      expiryMinutes: s.paymentMethods.expiryMinutes,
    })
    .from(s.paymentMethods)
    .where(eq(s.paymentMethods.providerId, providerId));
  const methods = new Map(methodRows.map((m) => [m.code, m]));
  const cats = await tx
    .select({ id: s.campaignCategories.id, slug: s.campaignCategories.slug })
    .from(s.campaignCategories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  // Campaign
  const DAY = 86_400_000;
  const anchor = SAMPLE_ANCHOR.getTime();
  await tx
    .insert(s.campaigns)
    .values(
      SAMPLE_CAMPAIGNS.map((c, i) => ({
        categoryId: catId.get(c.categorySlug)!,
        title: c.title,
        slug: c.slug,
        shortDescription: c.shortDescription,
        descriptionHtml: `<p>${c.shortDescription}</p><p>Ini adalah campaign <strong>contoh</strong> untuk pengembangan; data fiktif.</p>`,
        featuredImageUrl: PLACEHOLDER_IMAGE,
        featuredImageAlt: `Ilustrasi ${c.title}`,
        targetAmount: c.targetAmount,
        amountType: c.amountType,
        status: c.status,
        isFeatured: c.isFeatured,
        startAt: new Date(anchor - (120 - i * 5) * DAY),
        endAt:
          c.status === "completed"
            ? new Date(anchor - 5 * DAY)
            : new Date(anchor + (60 + i * 10) * DAY),
        publishedAt: c.status === "draft" ? null : new Date(anchor - (100 - i * 5) * DAY),
      })),
    )
    .onConflictDoNothing({ target: s.campaigns.slug });
  const campaignRows = await tx
    .select({ id: s.campaigns.id, slug: s.campaigns.slug, title: s.campaigns.title })
    .from(s.campaigns)
    .where(
      inArray(
        s.campaigns.slug,
        SAMPLE_CAMPAIGNS.map((c) => c.slug),
      ),
    );
  const campaign = new Map(campaignRows.map((c) => [c.slug, c]));

  await tx
    .insert(s.campaignAmountOptions)
    .values(
      SAMPLE_CAMPAIGNS.flatMap((c) =>
        c.options.map((o, i) => ({
          campaignId: campaign.get(c.slug)!.id,
          kind: c.amountType === "fixed" ? ("package" as const) : ("suggested" as const),
          label: o.label,
          amount: o.amount,
          sortOrder: i,
        })),
      ),
    )
    .onConflictDoNothing();
  const optionRows = await tx
    .select({
      id: s.campaignAmountOptions.id,
      campaignId: s.campaignAmountOptions.campaignId,
      amount: s.campaignAmountOptions.amount,
    })
    .from(s.campaignAmountOptions)
    .where(
      and(
        inArray(
          s.campaignAmountOptions.campaignId,
          campaignRows.map((c) => c.id),
        ),
        eq(s.campaignAmountOptions.kind, "package"),
      ),
    );
  const optionId = new Map(optionRows.map((o) => [`${o.campaignId}:${o.amount}`, o.id]));

  // Berita
  await tx
    .insert(s.campaignNews)
    .values(
      buildSampleNews().map((n) => ({
        campaignId: campaign.get(n.campaignSlug)!.id,
        title: n.title,
        slug: n.slug,
        excerpt: "Kabar perkembangan program dari tim lapangan (data contoh).",
        contentHtml:
          "<p>Alhamdulillah, berikut perkembangan program ini. Konten ini adalah data contoh.</p>",
        featuredImageUrl: PLACEHOLDER_IMAGE,
        featuredImageAlt: "Ilustrasi kabar terbaru",
        status: n.status,
        publishedAt: n.publishedAt,
      })),
    )
    .onConflictDoNothing({ target: [s.campaignNews.campaignId, s.campaignNews.slug] });

  // Donor (+ akun users untuk 10 donor)
  const donors = buildSampleDonors();
  await tx
    .insert(s.users)
    .values(
      donors
        .filter((d) => d.hasAccount)
        .map((d) => ({ name: d.name, email: d.email, emailVerified: new Date(anchor) })),
    )
    .onConflictDoNothing({ target: s.users.email });
  const userRows = await tx
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(
      inArray(
        s.users.email,
        donors.filter((d) => d.hasAccount).map((d) => d.email),
      ),
    );
  const userId = new Map(userRows.map((u) => [u.email, u.id]));
  await tx
    .insert(s.donors)
    .values(
      donors.map((d) => ({
        email: d.email,
        name: d.name,
        phoneE164: d.phoneE164,
        whatsappOptIn: d.whatsappOptIn,
        userId: userId.get(d.email) ?? null,
      })),
    )
    .onConflictDoNothing({ target: s.donors.email });
  const donorRows = await tx
    .select({ id: s.donors.id, email: s.donors.email })
    .from(s.donors)
    .where(
      inArray(
        s.donors.email,
        donors.map((d) => d.email),
      ),
    );
  const donorId = new Map(donorRows.map((d) => [d.email, d.id]));
  const donorByKey = new Map(donors.map((d) => [d.key, d]));

  // Transaksi
  const txs = buildSampleTransactions();
  const { receipts, lastSeqByYear } = assignReceiptNumbers(txs);
  for (const part of chunk(txs)) {
    await tx
      .insert(s.transactions)
      .values(
        part.map((t) => {
          const d = donorByKey.get(t.donorKey)!;
          const c = campaign.get(t.campaignSlug)!;
          const opt = SAMPLE_CAMPAIGNS.find((x) => x.slug === t.campaignSlug)!;
          return {
            code: t.code,
            accessTokenHash: t.accessTokenHash,
            accessTokenExpiresAt: new Date(t.createdAt.getTime() + 7 * DAY),
            campaignId: c.id,
            donorId: donorId.get(d.email)!,
            amountOptionId:
              t.optionIndex === null
                ? null
                : (optionId.get(`${c.id}:${opt.options[t.optionIndex]!.amount}`) ?? null),
            amount: t.amount,
            status: t.status,
            campaignTitleSnapshot: c.title,
            donorNameSnapshot: d.name,
            donorEmailSnapshot: d.email,
            donorPhoneSnapshot: d.phoneE164,
            isAnonymous: t.isAnonymous,
            prayer: t.prayer,
            whatsappOptIn: d.whatsappOptIn,
            paidAt: t.paidAt,
            receiptNo: receipts.get(t.code) ?? null,
            receiptIssuedAt: receipts.has(t.code) ? t.paidAt : null,
            source: { sample: true },
            createdAt: t.createdAt,
            updatedAt: t.paidAt ?? t.createdAt,
          };
        }),
      )
      .onConflictDoNothing({ target: s.transactions.code });
  }
  const txRows = await tx
    .select({ id: s.transactions.id, code: s.transactions.code })
    .from(s.transactions)
    .where(
      inArray(
        s.transactions.code,
        txs.map((t) => t.code),
      ),
    );
  const txId = new Map(txRows.map((t) => [t.code, t.id]));

  // Payment (maks. satu per transaksi; `created` tanpa payment) + event sintetis.
  const now = Date.now();
  const withPayment = txs.filter((t) => t.methodCode !== null);
  for (const part of chunk(withPayment)) {
    await tx
      .insert(s.payments)
      .values(
        part.map((t) => {
          const m = methods.get(t.methodCode!)!;
          const isVa = m.type === "virtual_account";
          return {
            transactionId: txId.get(t.code)!,
            paymentMethodId: m.id,
            providerId,
            providerRef: `sample-${t.code}`,
            amount: t.amount,
            status: t.status,
            instruction: isVa
              ? { bank: m.providerChannel, va_number: `8800${t.code.slice(-6)}`, sample: true }
              : { qr_string: `SAMPLE-QR-${t.code}`, sample: true },
            // Pending: kedaluwarsa di masa depan agar tampil sebagai "menunggu" di UI dev.
            expiresAt:
              t.status === "pending"
                ? new Date(now + 24 * 3_600_000)
                : new Date(t.createdAt.getTime() + m.expiryMinutes * 60_000),
            paidAt: t.paidAt,
            failureReason: t.status === "failed" ? "Ditolak oleh penerbit (contoh)" : null,
            createdAt: t.createdAt,
            updatedAt: t.paidAt ?? t.createdAt,
          };
        }),
      )
      .onConflictDoNothing({ target: [s.payments.providerId, s.payments.providerRef] });
  }
  const payRows = await tx
    .select({ id: s.payments.id, ref: s.payments.providerRef })
    .from(s.payments)
    .where(
      inArray(
        s.payments.providerRef,
        withPayment.map((t) => `sample-${t.code}`),
      ),
    );
  const payId = new Map(payRows.map((p) => [p.ref, p.id]));

  const midtransStatus: Record<string, string> = {
    pending: "pending",
    paid: "settlement",
    expired: "expire",
    failed: "deny",
    cancelled: "cancel",
    refunded: "refund",
  };
  const events = withPayment.flatMap((t) => {
    const paymentId = payId.get(`sample-${t.code}`)!;
    const base = (seq: number, status: string, at: Date) => ({
      providerId,
      providerEventId: `sample-${t.code}-${seq}`,
      paymentId,
      eventType: "notification",
      verification: "verified" as const,
      result: "processed" as const,
      statusReported: status,
      amountReported: t.amount,
      payload: {
        order_id: paymentId,
        transaction_status: status,
        gross_amount: `${t.amount}.00`,
        sample: true,
      },
      receivedAt: at,
      processedAt: at,
    });
    const first = base(1, "pending", new Date(t.createdAt.getTime() + 5_000));
    if (t.status === "pending") return [first];
    const endAt = t.paidAt ?? new Date(t.createdAt.getTime() + 3_600_000);
    return [first, base(2, midtransStatus[t.status]!, endAt)];
  });
  for (const part of chunk(events)) {
    await tx
      .insert(s.paymentEvents)
      .values(part)
      .onConflictDoNothing({
        target: [s.paymentEvents.providerId, s.paymentEvents.providerEventId],
      });
  }

  for (const [year, lastSeq] of lastSeqByYear) {
    await tx
      .insert(s.receiptCounters)
      .values({ year, lastSeq })
      .onConflictDoUpdate({
        target: s.receiptCounters.year,
        set: { lastSeq: sql`GREATEST(${s.receiptCounters.lastSeq}, excluded.last_seq)` },
      });
  }

  // BR-19: total campaign = jumlah transaksi paid, dihitung di transaksi DB yang sama.
  await tx.execute(sql`
    UPDATE campaigns c SET
      collected_amount = COALESCE(t.total, 0),
      donor_count = COALESCE(t.cnt, 0)
    FROM (SELECT ${s.campaigns.id} AS id FROM ${s.campaigns}
          WHERE ${inArray(
            s.campaigns.slug,
            SAMPLE_CAMPAIGNS.map((c) => c.slug),
          )}) sc
    LEFT JOIN (SELECT campaign_id, SUM(amount) AS total, COUNT(*) AS cnt
               FROM transactions WHERE status = 'paid' GROUP BY campaign_id) t
      ON t.campaign_id = sc.id
    WHERE c.id = sc.id`);
}

async function main() {
  const mode = parseSeedMode(process.argv.slice(2));
  if (mode === "sample") assertSampleAllowed(process.env.APP_ENV);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: s });
  try {
    await db.transaction(async (tx) => {
      await seedReference(tx);
      if (mode === "sample") await seedSample(tx);
    });
    console.log(`db:seed selesai (mode: ${mode}).`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
