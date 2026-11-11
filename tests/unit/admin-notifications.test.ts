import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { navForPermissions } from "@/lib/admin-auth/admin-nav";
import { renderEmailLayout } from "@/lib/notifications/email-layout";
import { dedupKey, notifyJobSchema, qstashDedupId, resendDedupKey } from "@/lib/notifications/jobs";
import { renderTemplate, SAMPLE_VARS, TEMPLATE_VARIABLES, validateTemplate, validateTemplateFields } from "@/lib/notifications/template";
import { notificationLogQuery, resendInputSchema, templateInputSchema } from "@/lib/validation/admin-notifications";
import { maskLogRow, maskRecipient, redactProviderResponse } from "@/server/services/admin-notification-service";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";

const LOG = "0196f000-0000-7000-8000-0000000000aa";

describe("P23 validasi template (AC-20.1)", () => {
  it.each([
    "No. KTP: {{donor_ktp}}",
    "{{constructor}}",
    "{{ __proto__ }}",
    "{{donor_name.length}}",
    "{{donor_name | upper}}",
    "{{#each x}}{{/each}}",
    "{{donor_name}",
    "{{ {{donor_name}} }}",
  ])("menolak %s", (body) => {
    expect(validateTemplate({ channel: "whatsapp", body }).ok).toBe(false);
  });

  it("menerima semua variabel whitelist", () => {
    const body = TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(" ");
    expect(validateTemplate({ channel: "email", subject: "Halo {{donor_name}}", body }).ok).toBe(true);
  });

  it("subjek: wajib (email), tanpa CR/LF (header injection), error per field", () => {
    expect(validateTemplateFields({ channel: "email", subject: "Halo\r\nBcc: x@y.z", body: "ok" }).subject.join()).toMatch(/baris baru/);
    const f = validateTemplateFields({ channel: "email", subject: "{{donor_ktp}}", body: "{{nik}}" });
    expect(f.ok).toBe(false);
    expect(f.subject.join()).toMatch(/donor_ktp/);
    expect(f.body.join()).toMatch(/nik/);
    expect(f.body.join()).not.toMatch(/donor_ktp/);
    expect(validateTemplateFields({ channel: "email", subject: "", body: "ok" }).subject.join()).toMatch(/wajib/);
  });

  it("pratinjau: nilai & teks di-escape di layout email (tanpa HTML/skrip admin)", () => {
    const body = renderTemplate('<script>alert(1)</script><img src=x onerror=alert(2)> {{donor_name}}', { ...SAMPLE_VARS, donor_name: "<b>x</b>" });
    const { html } = renderEmailLayout({ subject: "S", body, org: { name: "Org", address: "", siteUrl: "https://tebar.example" } });
    expect(html).not.toMatch(/<script>|<img src=x|<b>x<\/b>/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("schema input template & kirim ulang", () => {
    expect(templateInputSchema.safeParse({ name: "ab", subject: null, body: "x", version: 1 }).success).toBe(false);
    expect(resendInputSchema.safeParse({ logId: LOG }).data).toEqual({ logId: LOG, force: false, reason: "" });
    expect(resendInputSchema.safeParse({ logId: LOG, force: true, reason: "  pendek " }).success).toBe(false);
    expect(resendInputSchema.safeParse({ logId: LOG, force: true, reason: "donatur minta kirim ulang" }).success).toBe(true);
    // Tidak ada field penerima di input kirim ulang (zod object membuang key asing).
    expect(resendInputSchema.parse({ logId: LOG, recipient: "attacker@example.com" })).not.toHaveProperty("recipient");
  });

  it("query log: nilai rusak diabaikan, halaman dibatasi", () => {
    expect(notificationLogQuery.parse({ kanal: "sms", status: "x", hal: "999999", template: "bukan-uuid" })).toEqual({ hal: 1 });
  });
});

describe("P23 job kirim ulang", () => {
  it("schema, dedup id QStash, dedup_key baris baru", () => {
    const job = notifyJobSchema.parse({ event: "notification.resend", logId: LOG });
    expect(qstashDedupId(job)).toBe(`resend-${LOG}`);
    expect(dedupKey(job, "email")).toBe(`notification.resend:${LOG}:email`);
    expect(resendDedupKey("a", "b")).toBe("resend:a:b");
    expect(notifyJobSchema.safeParse({ event: "notification.resend", logId: "x" }).success).toBe(false);
  });
});

describe("P23 masking & redaksi (AC-21.1, OD-21)", () => {
  it("penerima dimasking tanpa donors.export", () => {
    expect(maskRecipient("email", "budi.santoso@gmail.com", true)).toBe("bu***@g***.com");
    expect(maskRecipient("whatsapp", "+6281234567890", true)).toBe("+62812****7890");
    expect(maskRecipient("email", "budi@gmail.com", false)).toBe("budi@gmail.com");
    const row = maskLogRow({ channel: "email" as const, recipient: "budi@gmail.com", errorMessage: "ditolak untuk budi@gmail.com" }, true);
    expect(JSON.stringify(row)).not.toContain("budi@gmail.com");
  });

  it("respons provider: kunci rahasia, token URL, email/nomor diredaksi", () => {
    const out = JSON.stringify(
      redactProviderResponse({
        messageId: "<abc@mail>",
        response: "250 OK accepted for budi@gmail.com",
        token: "FONNTE-SECRET",
        nested: { Authorization: "Bearer x", url: "https://x.test/a?token=abc123", target: "081234567890" },
      }),
    );
    expect(out).not.toMatch(/FONNTE-SECRET|Bearer x|abc123|budi@gmail\.com|081234567890/);
    expect(out).toContain("[REDACTED]");
  });

  it("L4: nomor WA sebagai angka JSON juga dimasking; angka biasa tidak diubah", () => {
    const out = redactProviderResponse({ target: 6281234567890, requestid: 12345, detail: { id: [6289876543210] } }) as Record<string, unknown>;
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/6281234567890|6289876543210/);
    expect(out.requestid).toBe(12345);
  });
});

describe("P23 otorisasi (BR-40)", () => {
  it("menu notifikasi hanya untuk role dengan notifications.write (owner, admin)", () => {
    const has = (role: keyof typeof ROLE_PERMISSIONS) =>
      navForPermissions(ROLE_PERMISSIONS[role]).some((g) => g.items.some((i) => i.href === "/admin/log-notifikasi"));
    expect([has("owner"), has("admin"), has("finance"), has("editor")]).toEqual([true, true, false, false]);
  });

  it("setiap server action notifikasi memanggil requireAdmin('notifications.write')", () => {
    const src = readFileSync("src/server/actions/admin-notification-actions.ts", "utf8");
    const fns = [...src.matchAll(/export async function (\w+)\([^]*?\{\n([^]*?)\n\}/g)];
    expect(fns.length).toBe(5);
    for (const [, name, body] of fns) expect(body, name).toMatch(/^\s*const ctx = await requireAdmin\("notifications\.write"\);/);
  });

  it("halaman template & log memanggil requireAdmin('notifications.write')", () => {
    for (const p of ["template-notifikasi", "log-notifikasi"]) {
      expect(readFileSync(`src/app/admin/(panel)/${p}/page.tsx`, "utf8")).toContain('await requireAdmin("notifications.write")');
    }
  });

  it("kirim tes tidak menerima tujuan dari klien", () => {
    const src = readFileSync("src/server/actions/admin-notification-actions.ts", "utf8");
    expect(src).toMatch(/export async function sendTestNotificationAction\(\s*templateId: string,\s*\)/);
  });
});
