import { describe, expect, it, vi } from "vitest";

// P25 (M5): nodemailer 10 — jalur kirim gmail.ts diuji dengan transport palsu (streamTransport):
// TIDAK ada koneksi SMTP / email sungguhan. Opsi SMTP yang diminta gmail.ts tetap diperiksa.
const captured = vi.hoisted(() => ({ options: [] as unknown[], raw: [] as string[] }));

vi.mock("nodemailer", async (orig) => {
  const real = (await orig<{ default: typeof import("nodemailer") }>()).default;
  const createTransport = (options: unknown) => {
    captured.options.push(options);
    const t = real.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    const send = t.sendMail.bind(t);
    t.sendMail = (async (msg: Parameters<typeof send>[0]) => {
      const info = await send(msg);
      captured.raw.push((info as unknown as { message: Buffer }).message.toString("utf8"));
      return { ...info, accepted: [msg.to], rejected: [], response: "250 fake" };
    }) as typeof t.sendMail;
    return t;
  };
  return { default: { ...real, createTransport }, createTransport };
});

vi.stubEnv("GMAIL_USER", "pengirim@example.test");
vi.stubEnv("GMAIL_APP_PASSWORD", "fake-app-password-uji");
vi.stubEnv("EMAIL_FROM", "Tebar Kebaikan <pengirim@example.test>");

const { createGmailSender } = await import("@/lib/email/gmail");

describe("gmail sender (nodemailer 10, transport palsu)", () => {
  it("SMTP Gmail 465 TLS; pesan berlampiran terbentuk; header tidak bisa disuntik", async () => {
    const res = await createGmailSender().send({
      to: "donatur@example.test",
      subject: "Terima kasih\r\nBcc: korban@example.test",
      html: "<p>Halo</p>",
      text: "Halo",
      attachments: [{ filename: "kuitansi.pdf", content: Buffer.from("%PDF-1.4 uji"), contentType: "application/pdf" }],
    });
    expect(captured.options[0]).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true });
    expect(res).toMatchObject({ accepted: 1, rejected: 0, response: "250 fake" });
    expect(res.messageId).toMatch(/@/);
    const raw = captured.raw[0]!;
    expect(raw).toContain("To: donatur@example.test");
    expect(raw).toContain('filename=kuitansi.pdf');
    expect(raw).not.toMatch(/^Bcc:/m);
    expect(raw).not.toContain("fake-app-password-uji");
  });
});
