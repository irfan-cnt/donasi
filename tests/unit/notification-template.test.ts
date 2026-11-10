import { describe, expect, it } from "vitest";
import { renderEmailLayout, textToHtml } from "@/lib/notifications/email-layout";
import { dedupKey, notifyJobSchema, qstashDedupId } from "@/lib/notifications/jobs";
import {
  escapeHtml,
  redactPayload,
  renderSubject,
  renderTemplate,
  TEMPLATE_VARIABLES,
  validateTemplate,
} from "@/lib/notifications/template";
import { followUpJobs } from "@/lib/payments/notification-jobs";
import type { ApplyVerifiedStatusResult } from "@/lib/payments/apply-verified-status";
import { NOTIFICATION_TEMPLATES as PAYMENT_TEMPLATES_FOR_TEST } from "../../scripts/seed/reference-data";

const TRX = "0196f000-0000-7000-8000-000000000001";
const PAY = "0196f000-0000-7000-8000-000000000002";
const SITE = "https://tebar.example";

describe("template engine (T-28)", () => {
  it("substitusi variabel whitelist; spasi di dalam kurung diperbolehkan", () => {
    expect(renderTemplate("Halo {{donor_name}}, {{ donation_amount }}", { donor_name: "Ani", donation_amount: "Rp 10.000" })).toBe(
      "Halo Ani, Rp 10.000",
    );
  });

  it("escape HTML pada nilai (mode email), teks statis tidak disentuh", () => {
    const out = renderTemplate("<b>{{donor_name}}</b>", { donor_name: `<script>alert("x")</script>&'` }, { escape: true });
    expect(out).toBe("<b>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;</b>");
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("variabel tidak dikenal → kosong saat render, ditolak saat simpan", () => {
    expect(renderTemplate("a{{process.env.SECRET}}b{{foo}}c", {})).toBe("abc");
    const v = validateTemplate({ channel: "email", subject: "Hai {{donor_name}}", body: "x {{foo}} {{ constructor }} {{a b}}" });
    expect(v.ok).toBe(false);
    expect(v.unknown).toEqual(expect.arrayContaining(["foo", "constructor", "a b"]));
  });

  it("validasi: kurung tidak berpasangan, subjek wajib untuk email, WA tanpa subjek ok", () => {
    expect(validateTemplate({ channel: "email", subject: "x", body: "{{donor_name" }).ok).toBe(false);
    expect(validateTemplate({ channel: "email", subject: "", body: "ok" }).errors.join()).toMatch(/Subjek wajib/);
    expect(validateTemplate({ channel: "whatsapp", body: "Hai {{donor_name}}" }).ok).toBe(true);
  });

  it("semua template seed lolos validasi (whitelist lengkap)", () => {
    expect(TEMPLATE_VARIABLES).toHaveLength(11);
    for (const t of PAYMENT_TEMPLATES_FOR_TEST) {
      expect(validateTemplate({ channel: t.channel, subject: t.subject, body: t.body }), `${t.event}/${t.channel}`).toMatchObject({ ok: true });
    }
  });

  it("subjek satu baris (anti header injection)", () => {
    expect(renderSubject("Donasi {{donor_name}}", { donor_name: "A\r\nBcc: x@y" })).toBe("Donasi A Bcc: x@y");
  });

  it("payload log: token akses di URL diganti ***", () => {
    const p = redactPayload({
      payment_url: `${SITE}/transaksi/TK-1/instruksi?t=abcDEF123_-xyz&x=1`,
      payment_instruction: "lihat https://x.test/a?token=SECRET123",
      donor_name: "Ani",
    });
    expect(p.payment_url).toBe(`${SITE}/transaksi/TK-1/instruksi?t=***&x=1`);
    expect(p.payment_instruction).toBe("lihat https://x.test/a?token=***");
    expect(JSON.stringify(p)).not.toMatch(/abcDEF123|SECRET123/);
  });
});

describe("layout email (T-29)", () => {
  const org = { name: "Tebar Kebaikan", address: "Jl. Contoh 1 <Jakarta>", siteUrl: SITE };

  it("HTML ter-escape, hanya URL situs sendiri yang jadi tautan", () => {
    const html = textToHtml(`Halo <img src=x onerror=1>\n${SITE}/transaksi/TK-1/menunggu\n\nhttps://evil.test/login`, SITE);
    expect(html).toContain("&lt;img src=x onerror=1&gt;<br>");
    expect(html).toContain(`<a href="${SITE}/transaksi/TK-1/menunggu"`);
    expect(html).not.toContain('href="https://evil.test');
    expect(html).toContain("https://evil.test/login");
  });

  it("menghasilkan HTML responsif + versi teks dengan alamat lembaga", () => {
    const out = renderEmailLayout({ subject: "Uji <b>", body: "Isi", org });
    expect(out.html).toContain('name="viewport"');
    expect(out.html).toContain("#0D6E56");
    expect(out.html).toContain("Jl. Contoh 1 &lt;Jakarta&gt;");
    expect(out.html).toContain("Uji &lt;b&gt;");
    expect(out.text).toContain("Jl. Contoh 1 <Jakarta>");
    expect(out.text).not.toContain("<p");
  });
});

describe("job notify & dedup", () => {
  it("dedup per event+transaksi(+payment)+kanal; sejalan dengan drain outbox §6a", () => {
    expect(dedupKey({ event: "payment.paid", transactionId: TRX, paymentId: PAY }, "email")).toBe(`payment.paid:${TRX}:email`);
    expect(dedupKey({ event: "payment.pending", transactionId: TRX, paymentId: PAY }, "whatsapp")).toBe(
      `payment.pending:${TRX}:${PAY}:whatsapp`,
    );
    expect(qstashDedupId({ event: "payment.paid", transactionId: TRX, paymentId: PAY })).toBe(`payment-paid-${TRX}`);
    expect(qstashDedupId({ event: "payment.pending", transactionId: TRX, paymentId: PAY })).toBe(`payment-pending-${PAY}`);
    expect(qstashDedupId({ event: "admin.alert", kind: "reconciliation", date: "2026-11-10", counts: {} })).toBe(
      "reconcile-alert-2026-11-10",
    );
  });

  it("skema menolak event/field tak dikenal dan body berisi PII bebas", () => {
    expect(notifyJobSchema.safeParse({ event: "donation.created", transactionId: TRX }).success).toBe(false);
    expect(notifyJobSchema.safeParse({ event: "payment.paid", transactionId: "x", paymentId: PAY }).success).toBe(false);
    expect(notifyJobSchema.safeParse({ event: "admin.alert", kind: "payment", ref: "a b" }).success).toBe(false);
  });

  const base: ApplyVerifiedStatusResult = {
    outcome: "processed",
    changed: true,
    becamePaid: false,
    previousStatus: "pending",
    newStatus: "expired",
    transactionId: TRX,
    transactionStatus: "expired",
    campaignId: null,
    receiptNo: null,
    alert: null,
  };

  it("followUpJobs: expired/failed hanya bila transaksi ikut terminal; alert → admin.alert", () => {
    expect(followUpJobs(base, PAY)).toEqual([{ event: "payment.expired", transactionId: TRX, paymentId: PAY }]);
    expect(followUpJobs({ ...base, newStatus: "failed", transactionStatus: "failed" }, PAY)[0]?.event).toBe("payment.failed");
    expect(followUpJobs({ ...base, transactionStatus: null }, PAY)).toEqual([]);
    expect(followUpJobs({ ...base, newStatus: "paid", becamePaid: true, transactionStatus: "paid" }, PAY)).toEqual([]);
    const withAlert = followUpJobs(
      {
        ...base,
        changed: false,
        alert: {
          kind: "amount_mismatch",
          paymentId: PAY,
          transactionId: TRX,
          expectedAmount: 1n,
          reportedAmount: 2n,
          reportedStatus: "paid",
          source: "webhook",
        },
      },
      PAY,
    );
    expect(withAlert).toEqual([
      { event: "admin.alert", kind: "payment", alert: "amount_mismatch", ref: PAY, paymentId: PAY, transactionId: TRX },
    ]);
    expect(notifyJobSchema.safeParse(withAlert[0]).success).toBe(true);
  });
});
