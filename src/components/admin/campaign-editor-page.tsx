import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { canDeletePermanently } from "@/lib/campaign-rules";
import { formatRupiah } from "@/lib/money";
import { createCampaignPreviewToken } from "@/lib/security/preview-token";
import { siteUrl } from "@/lib/site";
import { jakartaToday } from "@/lib/validation/admin-dashboard";
import {
  countCampaignTransactions,
  findCampaignById,
  findCampaignImages,
  findCampaignOptions,
  listCategoryOptions,
  listDisbursements,
  listNewsForCampaign,
} from "@/server/repositories/admin-campaign-repository";
import { formatWibDate } from "@/components/donor/format";
import { CampaignEditor, type CampaignEditorValues } from "./campaign-editor";
import { DisbursementPanel } from "./disbursement-panel";
import { Panel } from "./form-bits";

const EMPTY: CampaignEditorValues = {
  title: "",
  slug: "",
  categoryId: "",
  shortDescription: "",
  descriptionHtml: "",
  featuredImageUrl: null,
  featuredImageAlt: "",
  gallery: [],
  amountType: "open",
  minAmount: "10000",
  maxAmount: "",
  suggestions: ["25000", "50000", "100000", "250000"],
  packages: [],
  useTarget: false,
  targetAmount: "",
  startDate: "",
  endDate: "",
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
};

// Halaman editor campaign (server): requireAdmin(campaigns.read), muat data, lalu editor klien.
export async function CampaignEditorPage({ id }: { id: string | null }) {
  const ctx = await requireAdmin(id ? "campaigns.read" : "campaigns.write");
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(ctx.permissions, p);
  const categories = await listCategoryOptions();
  const host = new URL(siteUrl()).host;

  if (!id) {
    return (
      <CampaignEditor
        campaignId={null}
        status="draft"
        initial={EMPTY}
        categories={categories}
        canWrite
        canPublish={can("campaigns.publish")}
        canDelete={false}
        previewUrl={null}
        collectedLabel={formatRupiah(0n)}
        siteHost={host}
        news={null}
      />
    );
  }

  const c = await findCampaignById(id);
  if (!c) notFound();
  const [options, images, trx, news, disbursements] = await Promise.all([
    findCampaignOptions(id),
    findCampaignImages(id),
    countCampaignTransactions(id),
    listNewsForCampaign(id),
    can("disbursements.write") ? listDisbursements(id) : Promise.resolve([]),
  ]);

  const initial: CampaignEditorValues = {
    title: c.title,
    slug: c.slug,
    categoryId: c.categoryId,
    shortDescription: c.shortDescription,
    descriptionHtml: c.descriptionHtml,
    featuredImageUrl: c.featuredImageUrl,
    featuredImageAlt: c.featuredImageAlt ?? "",
    gallery: images.map((g) => ({ key: g.id, url: g.url, alt: g.alt, width: g.width, height: g.height })),
    amountType: c.amountType,
    minAmount: c.minAmount.toString(),
    maxAmount: c.maxAmount?.toString() ?? "",
    suggestions: options.filter((o) => o.kind === "suggested" && o.isActive).map((o) => o.amount.toString()),
    packages: options
      .filter((o) => o.kind === "package")
      .map((o) => ({ key: o.id, id: o.id, label: o.label ?? "", amount: o.amount.toString(), description: o.description ?? "", isActive: o.isActive })),
    useTarget: c.targetAmount !== null,
    targetAmount: c.targetAmount?.toString() ?? "",
    startDate: c.startAt ? jakartaToday(c.startAt) : "",
    endDate: c.endAt ? jakartaToday(c.endAt) : "",
    isFeatured: c.isFeatured,
    seoTitle: c.seoTitle ?? "",
    seoDescription: c.seoDescription ?? "",
  };

  // M3: tautan pratinjau hanya untuk pemegang campaigns.write.
  const previewUrl = c.status === "archived" || !can("campaigns.write") ? null : `/campaign/${c.slug}/pratinjau?token=${encodeURIComponent(createCampaignPreviewToken(c.id))}`;
  const disbursedTotal = disbursements.reduce((s, d) => s + d.amount, 0n);
  const remaining = c.collectedAmount - disbursedTotal;

  return (
    <CampaignEditor
      key={c.updatedAt.toISOString()}
      campaignId={c.id}
      status={c.status}
      initial={initial}
      categories={categories}
      canWrite={can("campaigns.write")}
      slugLocked={c.publishedAt !== null}
      canPublish={can("campaigns.publish")}
      canDelete={canDeletePermanently(c.status, trx.total)}
      previewUrl={previewUrl}
      collectedLabel={formatRupiah(c.collectedAmount)}
      siteHost={host}
      news={
        <Panel
          title="Berita campaign"
          action={
            can("news.write") ? (
              <Link href={`/admin/berita?tulis=1&campaign=${c.id}`} aria-label="Tulis berita" className="rounded-lg p-1.5 hover:bg-muted">
                <Plus className="size-4" aria-hidden />
              </Link>
            ) : null
          }
        >
          {news.length ? (
            <ul className="divide-y divide-border">
              {news.slice(0, 6).map((n) => (
                <li key={n.id} className="py-2">
                  {can("news.write") ? (
                    <Link href={`/admin/berita?edit=${n.id}`} className="block truncate text-sm font-medium hover:text-primary">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  )}
                  <p className="text-xs text-ink-faint">{n.status === "published" && n.publishedAt ? formatWibDate(n.publishedAt) : "Draf"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">Belum ada berita.</p>
          )}
        </Panel>
      }
      extra={
        can("disbursements.write") ? (
          <DisbursementPanel
            campaignId={c.id}
            items={disbursements.map((d) => ({ ...d, amount: d.amount.toString() }))}
            totalLabel={formatRupiah(disbursedTotal)}
            remainingLabel={formatRupiah(remaining < 0n ? 0n : remaining)}
            newsOptions={news.filter((n) => n.status === "published").map((n) => ({ id: n.id, title: n.title }))}
            today={jakartaToday(new Date())}
          />
        ) : null
      }
    />
  );
}
