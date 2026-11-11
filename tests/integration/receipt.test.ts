/**
 * P19 — PDF transaksi & kuitansi terhadap DB nyata (Neon `dev`): ownership donor (requireDonor
 * di-mock), token tamu, header no-store, kuitansi immutable (hash), event receipt.issued dengan
 * transport email PALSU (tanpa SMTP/QStash). Semua baris uji dihapus di afterAll.
 */
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { EmailMessage, EmailSender } from "@/lib/email/gmail";
import { newId } from "@/lib/id";
import { createLogger } from "@/lib/logger";
import { receiptHash } from "@/lib/pdf/receipt-data";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";

const session = vi.hoisted(() => ({ donorId: "" }));
vi.mock("@/lib/auth", () => ({
  requireDonor: async () => ({ userId: "u", donorId: session.donorId, email: "x@example.test", name: "x" }),
}));

const { GET: donorGET } = await import("@/app/api/donor/transactions/[code]/pdf/route");
const { GET: guestGET } = await import("@/app/api/transactions/[code]/receipt/route");
const { ensureReceipt } = await import("@/server/services/receipt-service");
const { findReceiptSourceById } = await import("@/server/repositories/receipt-repository");
const { processNotifyJob } = await import("@/server/services/notification-service");

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)("PDF transaksi & kuitansi (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const suffix = randomBytes(4).toString("hex");
  const campaignId = newId();
  const donorA = newId();
  const donorB = newId();
  const txIds: string[] = [];
  let methodId: string;
  let providerId: string;

  const ip = () => `10.19.${randomInt(256)}.${randomInt(256)}`;
  const code = () =>
    `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").slice(0, 6)}`;

  async function newTx(opts: { status?: "pending" | "paid"; donorId?: string; anonymous?: boolean; expired?: boolean } = {}) {
    const id = newId();
    const token = generateSessionToken();
    const c = code();
    const paid = opts.status === "paid";
    const receiptNo = paid ? `KW/1999/${String(randomInt(1_000_000)).padStart(6, "0")}` : null;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, paid_at, receipt_no, receipt_issued_at, campaign_title_snapshot, donor_name_snapshot,
        donor_email_snapshot, is_anonymous)
      values (${id}, ${c}, ${sha256(token)}, ${new Date(Date.now() + (opts.expired ? -60_000 : 7 * 86_400_000))},
        ${campaignId}, ${opts.donorId ?? donorA}, '1250000', ${opts.status ?? "pending"},
        ${paid ? new Date("2026-11-10T03:00:00Z") : null}, ${receiptNo}, ${paid ? new Date("2026-11-10T03:00:00Z") : null},
        'Campaign uji kuitansi', 'Nama Asli Donatur', ${`it+p19-${suffix}@example.test`}, ${opts.anonymous ?? false})`;
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status, paid_at)
      values (${newId()}, ${id}, ${methodId}, ${providerId}, ${randomUUID()}, '1250000', ${opts.status ?? "pending"},
        ${paid ? new Date("2026-11-10T03:00:00Z") : null})`;
    txIds.push(id);
    return { id, code: c, token, receiptNo };
  }

  const donorCall = (c: string, type: string, donorId = donorA) => {
    session.donorId = donorId;
    return donorGET(new NextRequest(`http://localhost/api/donor/transactions/${c}/pdf?type=${type}`), {
      params: Promise.resolve({ code: c }),
    });
  };
  const guestCall = (c: string, t: string) =>
    guestGET(
      new NextRequest(`http://localhost/api/transactions/${c}/receipt?${new URLSearchParams({ t })}`, {
        headers: { "x-forwarded-for": ip() },
      }),
      { params: Promise.resolve({ code: c }) },
    );

  async function expectPdf(res: Response, filename: RegExp) {
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(res.headers.get("content-disposition")).toMatch(new RegExp(`^attachment; filename="${filename.source}"$`));
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    return body.toString("latin1");
  }
  async function expect404(res: Response) {
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-type")).not.toBe("application/pdf");
  }

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] = await sql`select m.id, m.provider_id from payment_methods m join payment_providers p
      on p.id = m.provider_id where p.code = 'midtrans' and left(m.code, 3) <> 'it_' and m.type = 'virtual_account' limit 1`;
    if (!cat || !m) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji kuitansi', ${`it-p19-${suffix}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorA}, ${`it+p19a-${suffix}@example.test`}, 'Donatur A'),
      (${donorB}, ${`it+p19b-${suffix}@example.test`}, 'Donatur B')`;
  });

  afterAll(async () => {
    if (txIds.length) {
      await sql`delete from notification_logs where transaction_id = any(${txIds}::uuid[])`;
      await sql`delete from payments where transaction_id = any(${txIds}::uuid[])`;
      await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    }
    await sql`delete from donors where id in (${donorA}, ${donorB})`;
    await sql`delete from campaigns where id = ${campaignId}`;
  });

  it("donor pemilik: kuitansi paid → PDF attachment, private no-store", async () => {
    const t = await newTx({ status: "paid" });
    const text = await expectPdf(await donorCall(t.code, "receipt"), /kuitansi-KW-1999-\d{6}\.pdf/);
    expect(text).toContain(`Kuitansi ${t.receiptNo}`);
  });

  it("donor pemilik: ringkasan tersedia juga untuk transaksi pending", async () => {
    const t = await newTx({ status: "pending" });
    await expectPdf(await donorCall(t.code, "summary"), new RegExp(`transaksi-${t.code}\\.pdf`));
  });

  it("kuitansi non-paid → 404 (AC-14.1)", async () => {
    const t = await newTx({ status: "pending" });
    await expect404(await donorCall(t.code, "receipt"));
    await expect404(await guestCall(t.code, t.token));
  });

  it("donor lain → 404 (summary & receipt); tipe/kode tidak valid → 404", async () => {
    const t = await newTx({ status: "paid" });
    await expect404(await donorCall(t.code, "receipt", donorB));
    await expect404(await donorCall(t.code, "summary", donorB));
    await expect404(await donorCall(t.code, "lain"));
    await expect404(await donorCall("TK-BUKAN", "receipt"));
  });

  it("tamu: token sah → PDF; token salah/kedaluwarsa → 404", async () => {
    const t = await newTx({ status: "paid" });
    await expectPdf(await guestCall(t.code, t.token), /kuitansi-KW-1999-\d{6}\.pdf/);
    await expect404(await guestCall(t.code, generateSessionToken()));
    await expect404(await guestCall(t.code, "pendek"));
    const old = await newTx({ status: "paid", expired: true });
    await expect404(await guestCall(old.code, old.token));
  });

  it("immutable: hash tersimpan stabil saat render ulang & tidak terpengaruh perubahan profil/pengaturan", async () => {
    const t = await newTx({ status: "paid", anonymous: true });
    const first = await ensureReceipt((await findReceiptSourceById(t.id))!);
    expect(first?.donorName).toBe("Hamba Allah");
    const [row1] = await sql`select receipt_hash, receipt_snapshot from transactions where id = ${t.id}`;
    expect(Buffer.from(row1!.receipt_hash as Uint8Array).equals(receiptHash(first!))).toBe(true);
    expect(JSON.stringify(row1!.receipt_snapshot)).not.toContain("Nama Asli Donatur"); // tanpa PII
    // Profil donor berubah (nama, email) → kuitansi tidak berubah.
    await sql`update donors set name = 'Nama Baru', email = ${`it+p19new-${suffix}@example.test`} where id = ${donorA}`;
    const again = await ensureReceipt((await findReceiptSourceById(t.id))!);
    expect(again).toEqual(first);
    expect(receiptHash(again!).equals(receiptHash(first!))).toBe(true);
    const [row2] = await sql`select receipt_hash from transactions where id = ${t.id}`;
    expect(Buffer.from(row2!.receipt_hash as Uint8Array).equals(Buffer.from(row1!.receipt_hash as Uint8Array))).toBe(true);
    // Unduhan berikutnya merender dari snapshot yang sama.
    await expectPdf(await donorCall(t.code, "receipt"), /kuitansi-KW-1999-\d{6}\.pdf/);
  });

  describe("receipt.issued", () => {
    const sent: EmailMessage[] = [];
    const sender: EmailSender = {
      async send(m) {
        sent.push(m);
        return { messageId: "<x@test>", accepted: 1, rejected: 0, response: "250 OK" };
      },
    };
    const deps = (over: Record<string, unknown> = {}) => ({
      log: createLogger({ job: "it-p19" }),
      sender,
      quota: { increment: async () => 1, once: async () => false },
      config: { enabled: true, whatsappEnabled: false, adminEmail: null, dailyLimit: 1000, siteUrl: "https://tebar.example" },
      publishAdminAlert: async () => {},
      whatsapp: { send: async () => { throw new Error("WA tidak boleh dikirim"); } },
      publishWhatsapp: async () => {},
      whatsappSetting: async () => false,
      ...over,
    });

    it("paid → email dengan lampiran PDF kuitansi; job kedua → duplicate (satu email)", async () => {
      const t = await newTx({ status: "paid" });
      const before = sent.length;
      const job = { event: "receipt.issued", transactionId: t.id };
      expect(await processNotifyJob(job, deps() as never)).toMatchObject({ email: "sent" });
      expect(await processNotifyJob(job, deps() as never)).toMatchObject({ email: "duplicate" });
      expect(sent.length - before).toBe(1);
      const mail = sent[before]!;
      expect(mail.subject).toBe(`Kuitansi donasi ${t.code}`);
      expect(mail.text).toContain(`https://tebar.example/akun/donasi/${t.code}`);
      expect(mail.attachments).toHaveLength(1);
      expect(mail.attachments![0]!.contentType).toBe("application/pdf");
      expect(mail.attachments![0]!.content.subarray(0, 5).toString()).toBe("%PDF-");
      const [log] = await sql`select status, dedup_key from notification_logs where transaction_id = ${t.id}`;
      expect(log).toMatchObject({ status: "sent", dedup_key: `receipt.issued:${t.id}:email` });
    });

    it("non-paid → diabaikan, tanpa email", async () => {
      const t = await newTx({ status: "pending" });
      const before = sent.length;
      expect(await processNotifyJob({ event: "receipt.issued", transactionId: t.id }, deps() as never)).toMatchObject({
        ignored: "not_paid",
      });
      expect(sent.length).toBe(before);
    });

    it("payment.paid mem-publish receipt.issued; publish gagal tidak menggagalkan job paid", async () => {
      const t = await newTx({ status: "paid" });
      const [p] = await sql`select id from payments where transaction_id = ${t.id}`;
      const publishReceipt = vi.fn(async () => {
        throw new Error("qstash down");
      });
      const res = await processNotifyJob(
        { event: "payment.paid", transactionId: t.id, paymentId: p!.id },
        deps({ publishReceipt }) as never,
      );
      expect(publishReceipt).toHaveBeenCalledWith({ event: "receipt.issued", transactionId: t.id }, expect.anything());
      expect(res).toMatchObject({ email: "sent" });
      const [trx] = await sql`select status from transactions where id = ${t.id}`;
      expect(trx!.status).toBe("paid");
    });
  });
});
