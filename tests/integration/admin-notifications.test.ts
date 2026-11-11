/**
 * P23 — admin template & log notifikasi terhadap DB nyata (Neon `dev`): simpan template (whitelist
 * variabel, versi + 1, audit, konflik versi), aktivasi satu per event+kanal dalam transaksi, kirim tes
 * hanya ke email admin yang login (is_test, tanpa transaksi/dedup), kirim ulang membuat log baru +
 * audit, dedup event finansial kecuali paksa (butuh alasan & transactions.reconcile), consent WA
 * tidak bisa dipaksa, dan job `notification.resend` diproses dengan transport palsu.
 * Tidak ada email/WA sungguhan: sender, quota, publish, dan Fonnte di-inject. Template uji memakai
 * event fiktif `it-p23.*`; baris seed tidak diubah. Semua baris uji dihapus di afterAll.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { EmailMessage, EmailQuotaCounter, EmailSender } from "@/lib/email/gmail";
import { newId } from "@/lib/id";
import { createLogger } from "@/lib/logger";
import type { ResendJob } from "@/lib/notifications/jobs";
import type { WhatsappSender } from "@/lib/whatsapp/fonnte";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";
import { listNotificationLogs } from "@/server/repositories/admin-notification-repository";
import { AdminForbiddenError, type AdminActor } from "@/server/services/admin-campaign-service";
import {
  activateTemplate,
  duplicateTemplate,
  resendNotification,
  saveTemplate,
  sendTestNotification,
  type TestSendDeps,
} from "@/server/services/admin-notification-service";
import { processNotifyJob, type NotifyConfig, type NotifyDeps } from "@/server/services/notification-service";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 50_000n;

describe.skipIf(!ENABLED)("admin notifikasi P23 (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const tag = randomUUID().slice(0, 8);
  const event = `it-p23.${tag}`;
  const campaignId = newId();
  const donorId = newId();
  const donorEmail = `it-p23+${tag}-donor@example.test`;
  const adminIds: Record<string, string> = {};
  const adminEmail = (role: string) => `it-p23+${tag}-${role}@example.test`;
  const templateIds: string[] = [];
  const txIds: string[] = [];
  const paymentIds: string[] = [];
  let providerId: string;
  let methodId: string;

  const actor = (role: keyof typeof ROLE_PERMISSIONS, perms?: string[]): AdminActor => ({
    adminId: adminIds[role]!,
    permissions: perms ?? [...ROLE_PERMISSIONS[role]],
    ip: "127.0.0.1",
    ua: "vitest",
  });

  // ---- transport palsu (tidak ada SMTP/Fonnte/QStash sungguhan) ----
  const sent: EmailMessage[] = [];
  const sender: EmailSender = {
    async send(m) {
      sent.push(m);
      return { messageId: `<${randomUUID()}@test>`, accepted: 1, rejected: 0, response: "250 OK" };
    },
  };
  const quota: EmailQuotaCounter = { increment: async () => 1, once: async () => false };
  const testDeps = (enabled = true): TestSendDeps => ({ sender, quota, config: { enabled, dailyLimit: 1000, siteUrl: "https://tebar.example" } });
  const published: { job: ResendJob; channel: string }[] = [];
  const publish = vi.fn(async (job: ResendJob, channel: "email" | "whatsapp") => {
    published.push({ job, channel });
  });
  const waSent: { target: string; message: string }[] = [];
  const whatsapp: WhatsappSender = {
    async send(input) {
      waSent.push(input);
      return { detail: "success", id: ["1"], process: "pending", requestid: 1 };
    },
  };
  const config: NotifyConfig = { enabled: true, whatsappEnabled: true, adminEmail: null, dailyLimit: 1000, siteUrl: "https://tebar.example" };
  const notifyDeps = (over: Partial<NotifyConfig> = {}): NotifyDeps => ({
    log: createLogger({ test: "p23" }),
    sender,
    quota,
    config: { ...config, ...over },
    publishAdminAlert: async () => {},
    whatsapp,
    publishWhatsapp: async () => {},
    whatsappSetting: async () => true,
    loadReceipt: async () => ({ filename: "kuitansi.pdf", body: Buffer.from("%PDF-1.4") }),
  });

  const code = () => `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").padEnd(6, "A").slice(0, 6)}`;

  async function newTemplate(opts: { channel?: "email" | "whatsapp"; active?: boolean; body?: string; name?: string }) {
    const id = newId();
    const channel = opts.channel ?? "email";
    await sql`insert into notification_templates (id, event, channel, name, subject, body, is_active, version)
      values (${id}, ${event}, ${channel}, ${opts.name ?? `Uji P23 ${tag}`}, ${channel === "email" ? "Halo {{donor_name}}" : null},
        ${opts.body ?? "Assalamu'alaikum {{donor_name}}, donasi {{donation_amount}}."}, ${opts.active ?? false}, 1)`;
    templateIds.push(id);
    return id;
  }
  async function newTx(opts: { status: string; optIn?: boolean }) {
    const id = newId();
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount, status,
        campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot, whatsapp_opt_in, paid_at)
      values (${id}, ${code()}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId}, ${AMOUNT.toString()}, ${opts.status},
        ${`Campaign it-p23 ${tag}`}, 'Uji Donatur P23', ${donorEmail}, '+6281200002323', ${opts.optIn ?? false},
        ${opts.status === "paid" ? new Date() : null})`;
    txIds.push(id);
    const pay = newId();
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status, instruction, expires_at, paid_at)
      values (${pay}, ${id}, ${methodId}, ${providerId}, ${randomUUID()}, ${AMOUNT.toString()}, ${opts.status},
        ${JSON.stringify({ kind: "virtual_account", bankName: "bca", vaNumber: "1234567890123" })}::jsonb, now() + interval '1 day',
        ${opts.status === "paid" ? new Date() : null})`;
    paymentIds.push(pay);
    return { id, pay };
  }
  async function newLog(o: { tx: string; event: string; channel: "email" | "whatsapp"; status: string; dedup: string }) {
    const id = newId();
    await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, attempt, sent_at)
      values (${id}, ${o.channel}, ${o.channel === "email" ? donorEmail : "+6281200002323"}, ${o.event}, ${o.tx}, ${o.dedup}, ${o.status}, 1,
        ${o.status === "sent" ? new Date() : null})`;
    return id;
  }
  const logRow = async (id: string) =>
    (await sql`select * from notification_logs where id = ${id}`)[0] as Record<string, unknown> | undefined;
  const audits = async (action: string, entity: string) =>
    (await sql`select actor_id, metadata, before, after from audit_logs where action = ${action} and entity_id = ${entity}`) as {
      actor_id: string;
      metadata: Record<string, unknown>;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    }[];

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] = await sql`select m.id, m.provider_id from payment_methods m join payment_providers p
      on p.id = m.provider_id where p.code = 'midtrans' and left(m.code, 3) <> 'it_' and m.type = 'virtual_account' limit 1`;
    if (!cat || !m) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    for (const role of ["owner", "admin", "finance", "editor"] as const) {
      const id = newId();
      adminIds[role] = id;
      await sql`insert into admin_users (id, email, name, password_hash, must_change_password)
        values (${id}, ${adminEmail(role)}, ${`Uji P23 ${role}`}, 'x', false)`;
      await sql`insert into admin_user_roles (admin_user_id, role_id) select ${id}, id from roles where code = ${role}`;
    }
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, ${`Campaign it-p23 ${tag}`}, ${`it-p23-${tag}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${donorEmail}, 'Uji Donatur P23')`;
  });

  afterAll(async () => {
    const admins = Object.values(adminIds);
    await sql`delete from notification_logs where transaction_id = any(${txIds}::uuid[]) or template_id = any(${templateIds}::uuid[])
      or (is_test and recipient like ${`it-p23+${tag}-%`})`;
    await sql`delete from audit_logs where actor_id = any(${admins}::uuid[])`;
    await sql`delete from notification_templates where id = any(${templateIds}::uuid[]) or event = ${event}`;
    if (paymentIds.length) await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    if (txIds.length) await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
    await sql`delete from admin_user_roles where admin_user_id = any(${admins}::uuid[])`;
    await sql`delete from admin_users where id = any(${admins}::uuid[])`;
  });

  // ------------------------------------------------------------ Template

  it("AC-20.1: variabel ilegal ditolak saat simpan; template tidak berubah", async () => {
    const id = await newTemplate({});
    for (const body of ["No. KTP: {{donor_ktp}}", "{{constructor}}", "{{donor_name.toString}}", "{{ __proto__ }}", "{{donor_name}"]) {
      const r = await saveTemplate(actor("admin"), id, { name: "Uji", subject: "Halo", body, version: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors?.body).toBeTruthy();
    }
    const r = await saveTemplate(actor("admin"), id, { name: "Uji", subject: "Halo {{donor_ktp}}", body: "ok", version: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.subject).toMatch(/donor_ktp/);
    const crlf = await saveTemplate(actor("admin"), id, { name: "Uji", subject: "Halo\r\nBcc: x@y.z", body: "ok", version: 1 });
    expect(crlf.ok).toBe(false);
    const [row] = await sql`select version, body from notification_templates where id = ${id}`;
    expect(row).toMatchObject({ version: 1 });
  });

  it("simpan valid → version + 1, updated_by, audit diff; versi usang ditolak", async () => {
    const id = await newTemplate({});
    const r = await saveTemplate(actor("admin"), id, { name: "Uji simpan", subject: "Terima kasih {{donor_name}}", body: "Donasi {{donation_amount}} untuk {{campaign_title}}.", version: 1 });
    expect(r).toEqual({ ok: true, version: 2 });
    const [row] = await sql`select version, updated_by, subject from notification_templates where id = ${id}`;
    expect(row).toMatchObject({ version: 2, updated_by: adminIds.admin, subject: "Terima kasih {{donor_name}}" });
    const a = await audits("notification_template.update", id);
    expect(a).toHaveLength(1);
    expect(a[0]!.after).toMatchObject({ version: 2 });
    const stale = await saveTemplate(actor("admin"), id, { name: "Uji simpan", subject: "x", body: "y", version: 1 });
    expect(stale.ok).toBe(false);
  });

  it("editor & finance tidak punya notifications.write → AdminForbiddenError", async () => {
    const id = await newTemplate({});
    for (const role of ["editor", "finance"] as const) {
      await expect(saveTemplate(actor(role), id, { name: "x", subject: "x", body: "x", version: 1 })).rejects.toBeInstanceOf(AdminForbiddenError);
      await expect(activateTemplate(actor(role), id)).rejects.toBeInstanceOf(AdminForbiddenError);
      await expect(sendTestNotification(actor(role), id, testDeps())).rejects.toBeInstanceOf(AdminForbiddenError);
      await expect(resendNotification(actor(role), { logId: newId() }, { publish })).rejects.toBeInstanceOf(AdminForbiddenError);
    }
  });

  it("aktivasi: satu aktif per event+kanal (lainnya nonaktif dalam transaksi), audit", async () => {
    const a = await newTemplate({ active: true, name: `A ${tag}` });
    const b = await newTemplate({ name: `B ${tag}` });
    const wa = await newTemplate({ channel: "whatsapp", active: true, name: `WA ${tag}` });
    expect(await activateTemplate(actor("owner"), b)).toEqual({ ok: true });
    const rows = await sql`select id, is_active from notification_templates where event = ${event} and channel = 'email' and is_active`;
    expect(rows.map((r) => r.id)).toEqual([b]);
    // Kanal lain tidak tersentuh.
    expect((await sql`select is_active from notification_templates where id = ${wa}`)[0]).toMatchObject({ is_active: true });
    const au = await audits("notification_template.activate", b);
    expect(au[0]!.metadata).toMatchObject({ deactivated: [a] });
  });

  it("template tidak valid (diubah langsung di DB) tidak bisa diaktifkan", async () => {
    const bad = await newTemplate({ body: "{{donor_ktp}}" });
    const r = await activateTemplate(actor("owner"), bad);
    expect(r.ok).toBe(false);
  });

  it("duplikat → draf nonaktif versi 1 + audit", async () => {
    const src = await newTemplate({});
    const r = await duplicateTemplate(actor("admin"), src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    templateIds.push(r.id);
    expect((await sql`select is_active, version, event from notification_templates where id = ${r.id}`)[0]).toMatchObject({ is_active: false, version: 1, event });
  });

  // ------------------------------------------------------------ Kirim tes

  it("AC-20.3: kirim tes hanya ke email admin yang login (bukan donatur); log is_test tanpa transaksi/dedup", async () => {
    const id = await newTemplate({});
    const before = sent.length;
    const r = await sendTestNotification(actor("admin"), id, testDeps());
    expect(r).toMatchObject({ ok: true, status: "sent" });
    const mails = sent.slice(before);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe(adminEmail("admin"));
    expect(mails[0]!.to).not.toBe(donorEmail);
    expect(mails[0]!.subject).toMatch(/^\[TES\] Halo Ahmad Fauzi$/);
    expect(mails[0]!.html).toContain("data contoh");
    const [log] = await sql`select * from notification_logs where template_id = ${id} and is_test`;
    expect(log).toMatchObject({ is_test: true, transaction_id: null, dedup_key: null, status: "sent", recipient: adminEmail("admin") });
    const au = await audits("notification_template.test_send", id);
    expect(au).toHaveLength(1);
    expect(JSON.stringify(au[0]!.metadata)).not.toContain("@");
  });

  it("kirim tes saat NOTIFICATIONS_ENABLED=false → skipped, tidak ada email; WA ditolak (admin tanpa nomor)", async () => {
    const id = await newTemplate({});
    const before = sent.length;
    const r = await sendTestNotification(actor("owner"), id, testDeps(false));
    expect(r).toMatchObject({ ok: true, status: "skipped" });
    expect(sent.length).toBe(before);
    const wa = await newTemplate({ channel: "whatsapp" });
    const w = await sendTestNotification(actor("owner"), wa, testDeps());
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.error).toMatch(/nomor WhatsApp/);
    expect(waSent).toHaveLength(0);
  });

  // ------------------------------------------------------------ Kirim ulang

  it("kirim ulang event non-finansial yang gagal → log baru queued + audit + job diantrekan, lalu diproses", async () => {
    const { id: tx, pay } = await newTx({ status: "pending" });
    const orig = await newLog({ tx, event: "payment.pending", channel: "email", status: "failed", dedup: `payment.pending:${tx}:${pay}:email` });
    published.length = 0;
    const r = await resendNotification(actor("admin"), { logId: orig }, { publish });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await logRow(r.logId);
    expect(row).toMatchObject({ status: "queued", is_test: false, transaction_id: tx, dedup_key: `resend:${orig}:${r.logId}`, recipient: donorEmail });
    expect(row!.request_payload).toMatchObject({ resend_of: orig, forced: false, payment_id: pay });
    expect(published).toEqual([{ job: { event: "notification.resend", logId: r.logId }, channel: "email" }]);
    expect(await audits("notification.resend", r.logId)).toHaveLength(1);
    // Asal tidak berubah.
    expect(await logRow(orig)).toMatchObject({ status: "failed" });

    const before = sent.length;
    const out = await processNotifyJob({ event: "notification.resend", logId: r.logId }, notifyDeps());
    expect(out).toMatchObject({ email: "sent" });
    expect(sent.slice(before).map((m) => m.to)).toEqual([donorEmail]);
    expect(await logRow(r.logId)).toMatchObject({ status: "sent", attempt: 1 });
    // Job ganda → duplicate, tidak kirim lagi.
    expect(await processNotifyJob({ event: "notification.resend", logId: r.logId }, notifyDeps())).toMatchObject({ email: "duplicate" });
    expect(sent.length).toBe(before + 1);
  });

  it("NOTIFICATIONS_ENABLED=false: job kirim ulang dicatat skipped tanpa kirim", async () => {
    const { id: tx, pay } = await newTx({ status: "pending" });
    const orig = await newLog({ tx, event: "payment.pending", channel: "email", status: "failed", dedup: `payment.pending:${tx}:${pay}:email` });
    const r = await resendNotification(actor("owner"), { logId: orig }, { publish });
    if (!r.ok) throw new Error(r.error);
    const before = sent.length;
    expect(await processNotifyJob({ event: "notification.resend", logId: r.logId }, notifyDeps({ enabled: false }))).toMatchObject({ email: "skipped" });
    expect(sent.length).toBe(before);
    expect(await logRow(r.logId)).toMatchObject({ status: "skipped", error_message: "NOTIFICATIONS_ENABLED=false" });
  });

  it("event finansial sudah sent → ditolak tanpa paksa; paksa butuh alasan & transactions.reconcile; tercatat di audit", async () => {
    const { id: tx } = await newTx({ status: "paid" });
    const orig = await newLog({ tx, event: "payment.paid", channel: "email", status: "sent", dedup: `payment.paid:${tx}:email` });
    published.length = 0;
    const plain = await resendNotification(actor("admin"), { logId: orig }, { publish });
    expect(plain).toMatchObject({ ok: false, needsForce: true });
    const noReason = await resendNotification(actor("admin"), { logId: orig, force: true, reason: "" }, { publish });
    expect(noReason.ok).toBe(false);
    if (!noReason.ok) expect(noReason.fieldErrors?.reason).toBeTruthy();
    const noReconcile = actor("admin", ROLE_PERMISSIONS.admin.filter((p) => p !== "transactions.reconcile"));
    await expect(resendNotification(noReconcile, { logId: orig, force: true, reason: "donatur minta kirim lagi" }, { publish })).rejects.toBeInstanceOf(AdminForbiddenError);
    expect(published).toHaveLength(0);
    expect(await sql`select id from notification_logs where dedup_key like ${`resend:${orig}:%`}`).toHaveLength(0);

    const forced = await resendNotification(actor("owner"), { logId: orig, force: true, reason: `Donatur ${donorEmail} melapor email tidak masuk` }, { publish });
    expect(forced.ok).toBe(true);
    if (!forced.ok) return;
    const au = await audits("notification.resend_forced", forced.logId);
    expect(au).toHaveLength(1);
    expect(au[0]!.metadata).toMatchObject({ originalLogId: orig, forced: true, event: "payment.paid" });
    expect(String(au[0]!.metadata.reason)).not.toContain(donorEmail);
    const before = sent.length;
    expect(await processNotifyJob({ event: "notification.resend", logId: forced.logId }, notifyDeps())).toMatchObject({ email: "sent" });
    expect(sent.length).toBe(before + 1);
    // Baris tidak-paksa yang lolos ke antrean tetap di-dedup oleh handler.
    const sneaky = newId();
    await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, request_payload)
      values (${sneaky}, 'email', ${donorEmail}, 'payment.paid', ${tx}, ${`resend:${orig}:${sneaky}`}, 'queued',
        ${JSON.stringify({ resend_of: orig, forced: false, payment_id: null })}::jsonb)`;
    expect(await processNotifyJob({ event: "notification.resend", logId: sneaky }, notifyDeps())).toMatchObject({ email: "skipped" });
    expect(sent.length).toBe(before + 1);
  });

  it("WA tanpa consent: kirim ulang (juga paksa) ditolak; handler menolak baris WA tanpa consent", async () => {
    const { id: tx } = await newTx({ status: "paid", optIn: false });
    const orig = await newLog({ tx, event: "payment.paid", channel: "whatsapp", status: "skipped", dedup: `payment.paid:${tx}:whatsapp` });
    for (const input of [{ logId: orig }, { logId: orig, force: true, reason: "paksa tanpa consent harus gagal" }]) {
      const r = await resendNotification(actor("owner"), input, { publish });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/persetujuan WhatsApp/);
    }
    const forcedRow = newId();
    await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, request_payload)
      values (${forcedRow}, 'whatsapp', '+6281200002323', 'payment.paid', ${tx}, ${`resend:${orig}:${forcedRow}`}, 'queued',
        ${JSON.stringify({ resend_of: orig, forced: true, payment_id: null })}::jsonb)`;
    expect(await processNotifyJob({ event: "notification.resend", logId: forcedRow }, notifyDeps())).toMatchObject({ whatsapp: "skipped" });
    expect(waSent).toHaveLength(0);
  });

  it("WA dengan consent: kirim ulang memakai antrean WA; flag WHATSAPP_ENABLED=false tetap dihormati", async () => {
    const { id: tx, pay } = await newTx({ status: "pending", optIn: true });
    const orig = await newLog({ tx, event: "payment.pending", channel: "whatsapp", status: "failed", dedup: `payment.pending:${tx}:${pay}:whatsapp` });
    published.length = 0;
    const r = await resendNotification(actor("admin"), { logId: orig }, { publish });
    if (!r.ok) throw new Error(r.error);
    expect(published[0]).toMatchObject({ channel: "whatsapp" });
    expect(await processNotifyJob({ event: "notification.resend", logId: r.logId }, notifyDeps({ whatsappEnabled: false }))).toMatchObject({ whatsapp: "skipped" });
    expect(waSent).toHaveLength(0);
    expect(await logRow(r.logId)).toMatchObject({ status: "skipped", error_message: "WHATSAPP_ENABLED=false" });
  });

  it("log kirim tes tidak bisa dikirim ulang; publish gagal → baris kirim ulang failed", async () => {
    const id = await newTemplate({});
    await sendTestNotification(actor("finance", ["notifications.write"]), id, testDeps(false));
    const [testLog] = await sql`select id from notification_logs where template_id = ${id} and is_test`;
    const r = await resendNotification(actor("admin"), { logId: testLog!.id }, { publish });
    expect(r.ok).toBe(false);

    const { id: tx, pay } = await newTx({ status: "pending" });
    const orig = await newLog({ tx, event: "payment.pending", channel: "email", status: "failed", dedup: `payment.pending:${tx}:${pay}:email` });
    const failing = await resendNotification(actor("admin"), { logId: orig }, { publish: async () => { throw new Error("qstash down"); } });
    expect(failing.ok).toBe(false);
    const [row] = await sql`select status, error_message from notification_logs where dedup_key like ${`resend:${orig}:%`}`;
    expect(row).toMatchObject({ status: "failed", error_message: "gagal diantrekan (QStash)" });
  });

  it("M1: dua kirim ulang paralel (non-paksa) untuk notifikasi finansial gagal → tepat satu diterima", async () => {
    const { id: tx } = await newTx({ status: "paid" });
    const orig = await newLog({ tx, event: "payment.paid", channel: "email", status: "failed", dedup: `payment.paid:${tx}:email` });
    const results = await Promise.all([
      resendNotification(actor("admin"), { logId: orig }, { publish }),
      resendNotification(actor("owner"), { logId: orig }, { publish }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const refused = results.find((r) => !r.ok);
    if (refused && !refused.ok) expect(refused.error).toMatch(/masih dalam antrean/);
    expect(await sql`select id from notification_logs where dedup_key like ${`resend:${orig}:%`}`).toHaveLength(1);
  });

  it("M1: dua job kirim ulang finansial paralel + retry pipeline normal → tepat satu email", async () => {
    const { id: tx, pay } = await newTx({ status: "paid" });
    const orig = await newLog({ tx, event: "payment.paid", channel: "email", status: "failed", dedup: `payment.paid:${tx}:email` });
    const ids = [newId(), newId()];
    for (const id of ids) {
      await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, request_payload)
        values (${id}, 'email', ${donorEmail}, 'payment.paid', ${tx}, ${`resend:${orig}:${id}`}, 'queued',
          ${JSON.stringify({ resend_of: orig, forced: false, payment_id: pay })}::jsonb)`;
    }
    const before = sent.length;
    const outs = await Promise.all([
      ...ids.map((logId) => processNotifyJob({ event: "notification.resend", logId }, notifyDeps())),
      processNotifyJob({ event: "payment.paid", transactionId: tx, paymentId: pay }, notifyDeps()),
    ]);
    expect(sent.length - before).toBe(1);
    expect(outs.filter((o) => o.email === "sent")).toHaveLength(1);
    const rows = await sql`select status from notification_logs where transaction_id = ${tx} and event = 'payment.paid' and channel = 'email'`;
    expect(rows.filter((r) => r.status === "sent")).toHaveLength(1);
  });

  it("L2: kirim ulang paksa dibatasi 3× per (transaksi, event, kanal)", async () => {
    const { id: tx } = await newTx({ status: "paid" });
    const orig = await newLog({ tx, event: "payment.paid", channel: "email", status: "sent", dedup: `payment.paid:${tx}:email` });
    const results = [];
    for (const role of ["owner", "admin", "owner", "admin"] as const) {
      results.push(await resendNotification(actor(role), { logId: orig, force: true, reason: "uji batas kirim ulang paksa" }, { publish }));
    }
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    const last = results[3]!;
    if (!last.ok) expect(last.error).toMatch(/Batas kirim ulang paksa/);
  });

  it("L3: transaksi donatur teranonimkan (OD-14) → kirim ulang ditolak; job dilewati", async () => {
    const { id: tx } = await newTx({ status: "paid" });
    const orig = await newLog({ tx, event: "payment.paid", channel: "email", status: "failed", dedup: `payment.paid:${tx}:email` });
    // Bentuk snapshot setelah anonymizeDonorAccount (donor-repository.ts).
    await sql`update transactions set donor_email_snapshot = 'deleted+' || id::text || '@invalid', donor_phone_snapshot = null,
      donor_name_snapshot = 'Donatur Terhapus' where id = ${tx}`;
    const r = await resendNotification(actor("owner"), { logId: orig, force: true, reason: "uji anonimisasi donatur" }, { publish });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dianonimkan/);
    const row = newId();
    await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, request_payload)
      values (${row}, 'email', ${donorEmail}, 'payment.paid', ${tx}, ${`resend:${orig}:${row}`}, 'queued',
        ${JSON.stringify({ resend_of: orig, forced: true, payment_id: null })}::jsonb)`;
    const before = sent.length;
    expect(await processNotifyJob({ event: "notification.resend", logId: row }, notifyDeps())).toMatchObject({ email: "skipped" });
    expect(sent.length).toBe(before);
  });

  it("daftar log: tanpa donors.export pencarian penerima hanya persis; kode transaksi parsial", async () => {
    const { id: tx, pay } = await newTx({ status: "pending" });
    await newLog({ tx, event: "payment.pending", channel: "email", status: "sent", dedup: `payment.pending:${tx}:${pay}:email` });
    const base = { hal: 1 } as const;
    expect((await listNotificationLogs({ ...base, q: donorEmail }, true)).rows.some((r) => r.transactionId === tx)).toBe(true);
    expect((await listNotificationLogs({ ...base, q: donorEmail.slice(0, 12) + "@" }, true)).rows.some((r) => r.transactionId === tx)).toBe(false);
    expect((await listNotificationLogs({ ...base, q: `%@example.test` }, false)).rows.some((r) => r.transactionId === tx)).toBe(false);
    expect((await listNotificationLogs({ ...base, q: `${tag}-donor@` }, false)).rows.some((r) => r.transactionId === tx)).toBe(true);
    const [t] = await sql`select code from transactions where id = ${tx}`;
    expect((await listNotificationLogs({ ...base, q: String(t!.code) }, true)).rows.map((r) => r.transactionId)).toContain(tx);
    expect((await listNotificationLogs({ ...base, kanal: "whatsapp", q: String(t!.code) }, true)).rows).toHaveLength(0);
  });
});
