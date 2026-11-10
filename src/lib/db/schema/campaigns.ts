import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { adminUsers } from "./admin";
import { createdAt, pk, tstz, updatedAt } from "./columns";

export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "published",
  "paused",
  "completed",
  "archived",
]);
export const amountType = pgEnum("amount_type", ["open", "fixed"]);
export const amountOptionKind = pgEnum("amount_option_kind", ["suggested", "package"]);
export const newsStatus = pgEnum("news_status", ["draft", "published"]);

const money = (name: string) => bigint(name, { mode: "bigint" });

export const campaignCategories = pgTable("campaign_categories", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: pk(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => campaignCategories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description").notNull(),
    descriptionHtml: text("description_html").notNull(),
    featuredImageUrl: text("featured_image_url"),
    featuredImageAlt: text("featured_image_alt"),
    targetAmount: money("target_amount"),
    collectedAmount: money("collected_amount")
      .notNull()
      .default(sql`0`),
    donorCount: integer("donor_count").notNull().default(0),
    amountType: amountType("amount_type").notNull().default("open"),
    minAmount: money("min_amount")
      .notNull()
      .default(sql`10000`),
    maxAmount: money("max_amount"),
    startAt: tstz("start_at"),
    endAt: tstz("end_at"),
    status: campaignStatus("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: tstz("published_at"),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    updatedBy: uuid("updated_by").references(() => adminUsers.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("campaigns_title_check", sql`char_length(${t.title}) BETWEEN 10 AND 120`),
    check("campaigns_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("campaigns_short_description_check", sql`char_length(${t.shortDescription}) <= 200`),
    check("campaigns_target_amount_check", sql`${t.targetAmount} IS NULL OR ${t.targetAmount} > 0`),
    check("campaigns_collected_amount_check", sql`${t.collectedAmount} >= 0`),
    check("campaigns_min_amount_check", sql`${t.minAmount} >= 1000`),
    check(
      "campaigns_max_amount_check",
      sql`${t.maxAmount} IS NULL OR ${t.maxAmount} >= ${t.minAmount}`,
    ),
    check(
      "campaigns_end_at_check",
      sql`${t.endAt} IS NULL OR ${t.startAt} IS NULL OR ${t.endAt} > ${t.startAt}`,
    ),
    check(
      "campaigns_seo_description_check",
      sql`${t.seoDescription} IS NULL OR char_length(${t.seoDescription}) <= 160`,
    ),
    check(
      "published_requires_image",
      sql`${t.status} = 'draft' OR (${t.featuredImageUrl} IS NOT NULL AND ${t.featuredImageAlt} IS NOT NULL)`,
    ),
    index("campaigns_status_published_idx").on(t.status, t.publishedAt.desc()),
    index("campaigns_category_status_published_idx").on(
      t.categoryId,
      t.status,
      t.publishedAt.desc(),
    ),
    index("campaigns_featured_idx")
      .on(t.isFeatured)
      .where(sql`${t.status} = 'published'`),
    index("campaigns_end_at_idx")
      .on(t.endAt)
      .where(sql`${t.status} = 'published'`),
    index("campaigns_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
  ],
);

export const campaignImages = pgTable(
  "campaign_images",
  {
    id: pk(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("campaign_images_campaign_sort_idx").on(t.campaignId, t.sortOrder)],
);

export const campaignAmountOptions = pgTable(
  "campaign_amount_options",
  {
    id: pk(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    kind: amountOptionKind("kind").notNull(),
    label: text("label"),
    amount: money("amount").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("campaign_amount_options_amount_check", sql`${t.amount} >= 1000`),
    unique("campaign_amount_options_campaign_kind_amount_key").on(t.campaignId, t.kind, t.amount),
    index("campaign_amount_options_checkout_idx")
      .on(t.campaignId, t.kind, t.sortOrder)
      .where(sql`${t.isActive}`),
  ],
);

export const campaignNews = pgTable(
  "campaign_news",
  {
    id: pk(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    contentHtml: text("content_html").notNull(),
    featuredImageUrl: text("featured_image_url"),
    featuredImageAlt: text("featured_image_alt"),
    status: newsStatus("status").notNull().default("draft"),
    publishedAt: tstz("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    deletedAt: tstz("deleted_at"),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("campaign_news_excerpt_check", sql`char_length(${t.excerpt}) <= 300`),
    check(
      "campaign_news_published_at_check",
      sql`${t.status} = 'draft' OR ${t.publishedAt} IS NOT NULL`,
    ),
    unique("campaign_news_campaign_slug_key").on(t.campaignId, t.slug),
    index("campaign_news_campaign_status_published_idx").on(
      t.campaignId,
      t.status,
      t.publishedAt.desc(),
    ),
  ],
);

/** Rincian penyaluran dana (OD-06; BR-43). Soft delete. */
export const campaignDisbursements = pgTable(
  "campaign_disbursements",
  {
    id: pk(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    kind: text("kind", { enum: ["program", "operational", "bank_fee"] }).notNull(),
    description: text("description").notNull(),
    disbursedAt: date("disbursed_at", { mode: "string" }).notNull(),
    newsId: uuid("news_id").references(() => campaignNews.id, { onDelete: "set null" }),
    deletedAt: tstz("deleted_at"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => adminUsers.id),
    updatedBy: uuid("updated_by").references(() => adminUsers.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("campaign_disbursements_amount_check", sql`${t.amount} > 0`),
    check(
      "campaign_disbursements_kind_check",
      sql`${t.kind} IN ('program', 'operational', 'bank_fee')`,
    ),
    check("campaign_disbursements_description_check", sql`char_length(${t.description}) <= 500`),
    index("campaign_disbursements_campaign_idx")
      .on(t.campaignId, t.disbursedAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
