/**
 * P21 — admin campaign/berita/penyaluran terhadap DB nyata (Neon `dev`): validasi publish,
 * matriks permission, sanitasi XSS saat simpan, slug unik, aturan hapus/arsip, paket terpakai,
 * paket nonaktif tidak muncul di checkout, berita published_at, audit log, revalidateTag.
 * Semua baris uji ber-prefix it-p21 dan dihapus di afterAll (baris seed tidak disentuh).
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }));

import { newId } from "@/lib/id";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import { generateTransactionCode } from "@/lib/transaction-code";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";
import { blobStoreHost } from "@/lib/storage/blob-host";
import { isManagedImageUrl, setImageStorageForTests, type ImageStorage } from "@/lib/storage/image-storage";
import { listActiveAmountOptions } from "@/server/repositories/checkout-repository";
import {
  addDisbursement,
  AdminForbiddenError,
  deleteDisbursement,
  changeCampaignStatus,
  deleteCampaign,
  deleteNews,
  saveCampaign,
  saveNews,
  type AdminActor,
} from "@/server/services/admin-campaign-service";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;

/** Fake storage in-memory (pengganti Vercel Blob di test). */
class MemoryStorage implements ImageStorage {
  readonly kind = "memory";
  files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    const name = key.replace(/\//g, "-");
    this.files.set(name, data);
    return { url: `/api/dev-uploads/${name}` };
  }
}

describe.skipIf(!ENABLED)("admin campaign (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const adminId = newId();
  const email = `it-p21+${randomUUID()}@example.test`;
  const campaignIds: string[] = [];
  const donorIds: string[] = [];
  const tag = randomUUID().slice(0, 8);
  const storage = new MemoryStorage();
  let categoryId: string;
  let image: string;

  const actor = (role: keyof typeof ROLE_PERMISSIONS): AdminActor => ({
    adminId,
    permissions: [...ROLE_PERMISSIONS[role]],
    ip: "127.0.0.1",
    ua: "vitest",
  });

  const input = (over: Record<string, unknown> = {}) => ({
    title: `Campaign Uji P21 ${tag}`,
    slug: `it-p21-${tag}-${randomUUID().slice(0, 6)}`,
    categoryId,
    shortDescription: "Ringkasan uji",
    descriptionHtml: "<p>Deskripsi uji</p>",
    featuredImageUrl: null,
    featuredImageAlt: null,
    gallery: [],
    amountType: "open",
    minAmount: "10000",
    maxAmount: "",
    suggestions: ["25000", "50000"],
    packages: [],
    targetAmount: null,
    startDate: "",
    endDate: "",
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    ...over,
  });

  async function create(over: Record<string, unknown> = {}, role: keyof typeof ROLE_PERMISSIONS = "owner") {
    const res = await saveCampaign(actor(role), null, input(over));
    if (!res.ok) throw new Error(`${res.error} ${JSON.stringify(res.fieldErrors)}`);
    campaignIds.push(res.id);
    return res;
  }

  beforeAll(async () => {
    setImageStorageForTests(storage);
    image = (await storage.put("images/it/p21.webp", Buffer.from("x"))).url;
    await sql`insert into admin_users (id, email, name, password_hash) values (${adminId}, ${email}, 'Admin Uji P21', 'x')`;
    const [c] = await sql`select id from campaign_categories order by sort_order limit 1`;
    categoryId = c!.id as string;
  });

  beforeEach(() => revalidateTag.mockClear());

  afterAll(async () => {
    setImageStorageForTests(null);
    if (!ENABLED) return;
    for (const id of campaignIds) {
      await sql`delete from transactions where campaign_id = ${id}`;
      await sql`delete from campaign_disbursements where campaign_id = ${id}`;
      await sql`delete from campaign_news where campaign_id = ${id}`;
      await sql`delete from campaigns where id = ${id}`;
    }
    if (donorIds.length) await sql`delete from donors where id = any(${donorIds}::uuid[])`;
    await sql`delete from audit_logs where actor_id = ${adminId}`.catch(() => undefined);
    await sql`delete from admin_users where id = ${adminId} and email = ${email}`;
  });

  it("buat draft: XSS di deskripsi tersanitasi saat simpan, audit + revalidateTag", async () => {
    const res = await create(
      {
        descriptionHtml:
          '<p onclick="alert(1)">Halo<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><a href="https://contoh.org">ok</a></p>',
      },
      "editor",
    );
    const [row] = await sql`select description_html, status, created_by from campaigns where id = ${res.id}`;
    const html = row!.description_html as string;
    expect(html).not.toMatch(/script|onerror|onclick|javascript:|<img/i);
    expect(html).toContain('href="https://contoh.org"');
    expect(row!.status).toBe("draft");
    expect(row!.created_by).toBe(adminId);
    const audits = await sql`select action, after from audit_logs where entity_id = ${res.id}`;
    expect(audits.map((a) => a.action)).toContain("campaign.create");
    expect(revalidateTag).toHaveBeenCalledWith("campaigns", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(`campaign:${res.slug}`, { expire: 0 });
  });

  it("editor tanpa campaigns.publish ditolak (simpan & terbitkan maupun ubah status)", async () => {
    const res = await create({ featuredImageUrl: image, featuredImageAlt: "Alt" }, "editor");
    await expect(saveCampaign(actor("editor"), res.id, input({ slug: res.slug }), { publish: true })).rejects.toBeInstanceOf(AdminForbiddenError);
    await expect(changeCampaignStatus(actor("editor"), res.id, "published")).rejects.toBeInstanceOf(AdminForbiddenError);
    await expect(saveCampaign(actor("finance"), res.id, input({ slug: res.slug }))).rejects.toBeInstanceOf(AdminForbiddenError);
    const [row] = await sql`select status from campaigns where id = ${res.id}`;
    expect(row!.status).toBe("draft");
  });

  it("publish divalidasi (BR-02): tanpa gambar ditolak; lengkap → published + published_at", async () => {
    const res = await create();
    const fail = await changeCampaignStatus(actor("owner"), res.id, "published");
    expect(fail.ok).toBe(false);
    expect(!fail.ok && fail.fieldErrors?.publish).toMatch(/Gambar utama/);

    const ok = await saveCampaign(actor("owner"), res.id, input({ slug: res.slug, featuredImageUrl: image, featuredImageAlt: "Sumur warga" }), { publish: true });
    expect(ok.ok).toBe(true);
    const [row] = await sql`select status, published_at from campaigns where id = ${res.id}`;
    expect(row!.status).toBe("published");
    expect(row!.published_at).not.toBeNull();
    const audits = await sql`select action from audit_logs where entity_id = ${res.id}`;
    expect(audits.map((a) => a.action)).toContain("campaign.publish");

    // Tayang → harus tetap lengkap (hapus gambar ditolak); transisi tidak sah ditolak.
    const strip = await saveCampaign(actor("owner"), res.id, input({ slug: res.slug, shortDescription: "" }));
    expect(strip.ok).toBe(false);
    expect((await changeCampaignStatus(actor("owner"), res.id, "paused")).ok).toBe(true);
    expect((await changeCampaignStatus(actor("owner"), res.id, "completed")).ok).toBe(true);
    expect((await changeCampaignStatus(actor("owner"), res.id, "published")).ok).toBe(false);
  });

  it("OD-20: editor boleh ubah konten campaign tayang; featured, slug & status tetap dijaga", async () => {
    const draft = await create({ isFeatured: true }, "editor");
    const [d] = await sql`select is_featured from campaigns where id = ${draft.id}`;
    expect(d!.is_featured).toBe(false); // editor tidak bisa menjadikan Program Pilihan

    const res = await create({ featuredImageUrl: image, featuredImageAlt: "Alt" });
    expect((await changeCampaignStatus(actor("owner"), res.id, "published")).ok).toBe(true);
    const pub = input({ slug: res.slug, featuredImageUrl: image, featuredImageAlt: "Alt" });
    expect((await saveCampaign(actor("admin"), res.id, { ...pub, isFeatured: true })).ok).toBe(true);
    // Editor mengubah konten (judul) campaign tayang: boleh; isFeatured tetap (tidak bisa dimatikan editor).
    const edited = await saveCampaign(actor("editor"), res.id, { ...pub, title: `Judul diubah editor ${tag}`, isFeatured: false });
    expect(edited.ok).toBe(true);
    const [e] = await sql`select title, is_featured, status from campaigns where id = ${res.id}`;
    expect(e).toMatchObject({ title: `Judul diubah editor ${tag}`, is_featured: true, status: "published" });
    await expect(changeCampaignStatus(actor("editor"), res.id, "paused")).rejects.toBeInstanceOf(AdminForbiddenError);
    const editorSlug = await saveCampaign(actor("editor"), res.id, { ...pub, slug: `${res.slug}-x` });
    expect(!editorSlug.ok && editorSlug.fieldErrors?.slug).toMatch(/terkunci/);
    const renamed = await saveCampaign(actor("owner"), res.id, { ...pub, slug: `${res.slug}-baru` });
    expect(!renamed.ok && renamed.fieldErrors?.slug).toMatch(/terkunci/);

    // L2: arsip mencatat isFeatured di audit. P25 (OD-30): arsip hanya dari completed.
    expect((await changeCampaignStatus(actor("owner"), res.id, "archived")).ok).toBe(false);
    expect((await changeCampaignStatus(actor("owner"), res.id, "completed")).ok).toBe(true);
    expect((await changeCampaignStatus(actor("owner"), res.id, "archived")).ok).toBe(true);
    const [a] = await sql`select before, after from audit_logs where entity_id = ${res.id} and action = 'campaign.archive'`;
    expect(a!.before).toMatchObject({ isFeatured: true });
    expect(a!.after).toMatchObject({ status: "archived", isFeatured: false });
  });

  it("M2: penyaluran ditolak untuk campaign draf dan bukti berita draf", async () => {
    const draft = await create();
    const base = { amount: "1000", kind: "program", description: "Penyaluran uji", disbursedAt: "2026-11-01" };
    const r1 = await addDisbursement(actor("finance"), { ...base, campaignId: draft.id });
    expect(!r1.ok && r1.error).toMatch(/draf/);

    const pub = await create({ featuredImageUrl: image, featuredImageAlt: "Alt" });
    expect((await changeCampaignStatus(actor("owner"), pub.id, "published")).ok).toBe(true);
    const n = await saveNews(actor("editor"), null, { campaignId: pub.id, title: "Bukti draf penyaluran", slug: "bukti-draf", contentHtml: "<p>x</p>" });
    const r2 = await addDisbursement(actor("finance"), { ...base, campaignId: pub.id, newsId: n.ok ? n.id : null });
    expect(!r2.ok && r2.fieldErrors?.newsId).toBeTruthy();
  });

  it("gambar dari URL eksternal sembarang ditolak", async () => {
    const res = await saveCampaign(actor("owner"), null, input({ featuredImageUrl: "https://evil.example/x.png", featuredImageAlt: "x" }));
    expect(res.ok).toBe(false);
    const own = blobStoreHost({ BLOB_STORE_ID: process.env.BLOB_STORE_ID, BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN });
    if (own) expect(isManagedImageUrl(`https://${own}/images/x.webp`)).toBe(true);
    // M1: store Blob lain (wildcard) tidak lagi diterima.
    expect(isManagedImageUrl("https://zzzzotherstore1.public.blob.vercel-storage.com/images/x.webp")).toBe(false);
    expect(isManagedImageUrl("https://evil.example/x.webp")).toBe(false);
  });

  it("slug unik + slug reserved ditolak", async () => {
    const first = await create();
    const dup = await saveCampaign(actor("owner"), null, input({ slug: first.slug }));
    expect(dup.ok).toBe(false);
    expect(!dup.ok && dup.fieldErrors?.slug).toBeTruthy();
    const reserved = await saveCampaign(actor("owner"), null, input({ slug: "pratinjau" }));
    expect(!reserved.ok && reserved.fieldErrors?.slug).toBeTruthy();
  });

  it("paket nonaktif tidak muncul di checkout; paket terpakai transaksi tidak bisa dihapus; hapus → arsip", async () => {
    const res = await create({
      amountType: "fixed",
      featuredImageUrl: image,
      featuredImageAlt: "Alt",
      packages: [
        { label: "Paket A", amount: "50000", isActive: true },
        { label: "Paket B", amount: "75000", isActive: false },
      ],
    });
    const active = await listActiveAmountOptions(res.id, "package");
    expect(active.map((o) => o.label)).toEqual(["Paket A"]);

    // Transaksi memakai Paket A.
    const donorId = newId();
    donorIds.push(donorId);
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it-p21+${randomUUID()}@example.test`}, 'Donatur Uji')`;
    const pkgA = active[0]!.id;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount_option_id, amount,
        status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot)
      values (${newId()}, ${generateTransactionCode(new Date())}, ${sha256(generateSessionToken())}, now(), ${res.id}, ${donorId}, ${pkgA}, 50000,
        'pending', 'Uji', 'Donatur Uji', 'it-p21@example.test')`;

    const opts = await sql`select id, label from campaign_amount_options where campaign_id = ${res.id} and kind = 'package' order by sort_order`;
    const pkgB = opts.find((o) => o.label === "Paket B")!.id as string;
    const removeA = await saveCampaign(actor("owner"), res.id, input({
      slug: res.slug, amountType: "fixed", featuredImageUrl: image, featuredImageAlt: "Alt",
      packages: [{ id: pkgB, label: "Paket B", amount: "75000", isActive: true }],
    }));
    expect(removeA.ok).toBe(false);
    expect(!removeA.ok && removeA.error).toMatch(/nonaktifkan/);

    // Nonaktifkan A (boleh), B aktif & urutan ditukar.
    const deact = await saveCampaign(actor("owner"), res.id, input({
      slug: res.slug, amountType: "fixed", featuredImageUrl: image, featuredImageAlt: "Alt",
      packages: [
        { id: pkgB, label: "Paket B", amount: "75000", isActive: true },
        { id: pkgA, label: "Paket A", amount: "50000", isActive: false },
      ],
    }));
    expect(deact.ok).toBe(true);
    expect((await listActiveAmountOptions(res.id, "package")).map((o) => o.label)).toEqual(["Paket B"]);

    // Draft dengan transaksi tidak bisa dihapus permanen; arsip juga tidak (OD-30: hanya dari completed).
    const del = await deleteCampaign(actor("owner"), res.id);
    expect(del.ok).toBe(false);
    expect(!del.ok && del.error).toMatch(/selesaikan lalu arsipkan/i);
    expect((await changeCampaignStatus(actor("owner"), res.id, "archived")).ok).toBe(false);
  });

  it("AC-24.2: open → fixed dengan transaksi pending memberi peringatan", async () => {
    const res = await create();
    const donorId = newId();
    donorIds.push(donorId);
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it-p21+${randomUUID()}@example.test`}, 'Donatur Uji')`;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount,
        status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot)
      values (${newId()}, ${generateTransactionCode(new Date())}, ${sha256(generateSessionToken())}, now(), ${res.id}, ${donorId}, 30000,
        'pending', 'Uji', 'Donatur Uji', 'it-p21@example.test')`;
    const r = await saveCampaign(actor("owner"), res.id, input({ slug: res.slug, amountType: "fixed", packages: [{ label: "P", amount: "50000", isActive: true }] }));
    expect(r.ok && r.warning).toMatch(/1 transaksi menunggu/);
  });

  it("hapus permanen draft tanpa transaksi", async () => {
    const res = await create();
    expect((await deleteCampaign(actor("editor"), res.id)).ok).toBe(true);
    const rows = await sql`select 1 from campaigns where id = ${res.id}`;
    expect(rows).toHaveLength(0);
    const audits = await sql`select action from audit_logs where entity_id = ${res.id}`;
    expect(audits.map((a) => a.action)).toContain("campaign.delete");
  });

  it("berita: slug unik per campaign, publish mengisi published_at (AC-25.1), soft delete, XSS tersanitasi", async () => {
    const c = await create();
    const news = { campaignId: c.id, title: "Kabar penyaluran pertama", slug: "kabar-pertama", contentHtml: "<p>Isi<script>x()</script></p>" };
    const draft = await saveNews(actor("editor"), null, news);
    expect(draft.ok).toBe(true);
    const id = draft.ok ? draft.id : "";
    const [d] = await sql`select status, published_at, content_html from campaign_news where id = ${id}`;
    expect(d!.status).toBe("draft");
    expect(d!.published_at).toBeNull();
    expect(d!.content_html).not.toMatch(/script/);

    const dup = await saveNews(actor("editor"), null, news);
    expect(!dup.ok && dup.fieldErrors?.slug).toBeTruthy();

    const pub = await saveNews(actor("editor"), id, news, { publish: true });
    expect(pub.ok).toBe(true);
    const [p] = await sql`select status, published_at from campaign_news where id = ${id}`;
    expect(p!.status).toBe("published");
    expect(p!.published_at).not.toBeNull();
    expect(revalidateTag).toHaveBeenCalledWith(`campaign:${c.slug}`, { expire: 0 });

    await expect(saveNews(actor("finance"), null, { ...news, slug: "lain" })).rejects.toBeInstanceOf(AdminForbiddenError);
    expect((await deleteNews(actor("owner"), id)).ok).toBe(true);
    const [s] = await sql`select deleted_at from campaign_news where id = ${id}`;
    expect(s!.deleted_at).not.toBeNull();
    const audits = await sql`select action from audit_logs where entity_id = ${id} order by id`;
    expect(audits.map((a) => a.action)).toEqual(["news.create", "news.publish", "news.delete"]);
  });

  it("penyaluran: hanya disbursements.write; total tidak boleh melebihi terkumpul (BR-43)", async () => {
    const c = await create({ featuredImageUrl: image, featuredImageAlt: "Alt" });
    expect((await changeCampaignStatus(actor("owner"), c.id, "published")).ok).toBe(true);
    const d = { campaignId: c.id, amount: "1000", kind: "program", description: "Penyaluran uji", disbursedAt: "2026-11-01" };
    await expect(addDisbursement(actor("editor"), d)).rejects.toBeInstanceOf(AdminForbiddenError);
    const over = await addDisbursement(actor("finance"), d);
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error).toMatch(/melebihi/);
  });

  it("AC-33.5: tambah & hapus penyaluran tercatat di audit log dengan before/after", async () => {
    const c = await create({ featuredImageUrl: image, featuredImageAlt: "Alt" });
    expect((await changeCampaignStatus(actor("owner"), c.id, "published")).ok).toBe(true);
    // Terkumpul fiktif khusus campaign uji ini (BR-43 butuh dana terkumpul); baris dihapus di afterAll.
    await sql`update campaigns set collected_amount = 5000 where id = ${c.id}`;
    const added = await addDisbursement(actor("finance"), {
      campaignId: c.id, amount: "1000", kind: "program", description: "Penyaluran uji audit", disbursedAt: "2026-11-01",
    });
    expect(added.ok).toBe(true);
    const id = added.ok ? added.id : "";
    const [create_] = await sql`select before, after from audit_logs where entity_id = ${id} and action = 'disbursement.create'`;
    expect(create_?.before).toBeNull();
    expect(create_?.after).toMatchObject({ campaignId: c.id, amount: "1000", kind: "program" });

    expect((await deleteDisbursement(actor("finance"), id)).ok).toBe(true);
    const [del] = await sql`select before, after from audit_logs where entity_id = ${id} and action = 'disbursement.delete'`;
    expect(del?.before).toEqual({ deletedAt: null });
    expect(del?.after).toMatchObject({ deletedAt: expect.any(String) });
  });
});
