import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { getEnv, requireEnvValue } from "@/lib/env";
import { getRedis } from "@/lib/redis";

// Pengiriman email via Gmail SMTP (T-29, integrations.md): smtp.gmail.com:465 TLS langsung,
// tanpa pool (serverless). GMAIL_APP_PASSWORD hanya dibaca di sini, tidak pernah di-log/disimpan.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** P19: lampiran (mis. kuitansi PDF). */
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** Ringkasan respons SMTP yang aman disimpan (tanpa kredensial). */
export interface EmailSendResult {
  messageId: string | null;
  accepted: number;
  rejected: number;
  /** Kode/teks respons SMTP, dipangkas (mis. "250 2.0.0 OK …"). */
  response: string | null;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

let transporter: Transporter<SMTPTransport.SentMessageInfo> | undefined;

export function createGmailSender(): EmailSender {
  return {
    async send(message) {
      const env = getEnv();
      const options: SMTPTransport.Options = {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        // SMTPTransport tunggal (bukan SMTPPool): tanpa pool koneksi di serverless.
        auth: {
          user: requireEnvValue(env, "GMAIL_USER"),
          pass: requireEnvValue(env, "GMAIL_APP_PASSWORD"),
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      };
      transporter ??= nodemailer.createTransport(options);
      const info = await transporter.sendMail({
        from: requireEnvValue(env, "EMAIL_FROM"),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return {
        messageId: typeof info.messageId === "string" ? info.messageId : null,
        accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
        rejected: Array.isArray(info.rejected) ? info.rejected.length : 0,
        response: typeof info.response === "string" ? info.response.slice(0, 120) : null,
      };
    },
  };
}

/** Counter harian email (kuota Gmail) per tanggal WIB. */
export interface EmailQuotaCounter {
  /** Naikkan & kembalikan jumlah email hari itu (termasuk yang ini). */
  increment(date: string): Promise<number>;
  /** true sekali per kunci (SET NX) — untuk alert 80% hanya sekali per hari. */
  once(key: string): Promise<boolean>;
}

export function createRedisQuotaCounter(): EmailQuotaCounter {
  return {
    async increment(date) {
      const key = `tk:email:daily:${date}`;
      const n = await getRedis().incr(key);
      if (n === 1) await getRedis().expire(key, 2 * 86_400);
      return n;
    },
    async once(key) {
      return (await getRedis().set(`tk:once:${key}`, "1", { nx: true, ex: 2 * 86_400 })) === "OK";
    },
  };
}
