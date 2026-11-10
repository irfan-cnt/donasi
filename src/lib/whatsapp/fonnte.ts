import "server-only";
import { getEnv, requireEnvValue } from "@/lib/env";

// Klien WhatsApp Fonnte (T-30, BR-26, notification-architecture.md §WhatsApp). Dokumentasi resmi
// (docs.fonnte.com/api-send-message, diverifikasi 10 Nov 2026): POST https://api.fonnte.com/send,
// header `Authorization: <TOKEN>` (tanpa "Bearer"), body form `target`, `message`, `countryCode`.
// FONNTE_TOKEN hanya dibaca di modul ini; tidak pernah di-log, disimpan, atau dikembalikan.
// Tidak ada retry di sini — retry dilakukan QStash (job /api/jobs/notify).

export const FONNTE_DEFAULT_API_URL = "https://api.fonnte.com/send";
export const FONNTE_TIMEOUT_MS = 10_000;

export type FonnteErrorCode =
  | "invalid_token"
  | "device_disconnected"
  | "invalid_target"
  | "quota_exceeded"
  | "invalid_input"
  | "timeout"
  | "network"
  | "http_error"
  | "unknown";

/** Kode yang layak di-retry QStash (gangguan sementara). Sisanya gagal permanen. */
const RETRYABLE = new Set<FonnteErrorCode>(["timeout", "network", "http_error", "unknown"]);

export class FonnteError extends Error {
  readonly retryable: boolean;
  constructor(
    public readonly code: FonnteErrorCode,
    /** Ringkasan respons aman disimpan (tanpa token). */
    public readonly response: Record<string, unknown> | null = null,
  ) {
    super(`fonnte: ${code}`);
    this.name = "FonnteError";
    this.retryable = RETRYABLE.has(code);
  }
}

/** Respons sukses yang disimpan ke notification_logs.provider_response. */
export interface WhatsappSendResult {
  detail: string | null;
  id: string[];
  process: string | null;
  requestid: number | string | null;
}

export interface WhatsappSender {
  send(input: { target: string; message: string }): Promise<WhatsappSendResult>;
}

/**
 * E.164 tersimpan (+62…) → format target Fonnte: digit dengan kode negara, tanpa '+'
 * (dikirim bersama `countryCode=0` agar Fonnte tidak mengubah awalan). Toleran terhadap "08…"
 * dan "62…" lama. null bila bukan nomor seluler Indonesia yang valid.
 */
export function toFonnteTarget(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[\s\-().]/g, "");
  let rest: string | null = null;
  if (/^\+62\d+$/.test(digits)) rest = digits.slice(3);
  else if (/^62\d+$/.test(digits)) rest = digits.slice(2);
  else if (/^0\d+$/.test(digits)) rest = digits.slice(1);
  if (!rest || !/^8\d{7,12}$/.test(rest)) return null;
  return `62${rest}`;
}

/** Peta `reason` Fonnte (verbatim di docs) → kode internal. */
export function mapFonnteReason(reason: unknown): FonnteErrorCode {
  const r = typeof reason === "string" ? reason.toLowerCase() : "";
  if (r.includes("token")) return "invalid_token";
  if (r.includes("disconnect") || r.includes("device")) return "device_disconnected";
  if (r.includes("target")) return "invalid_target";
  if (r.includes("quota")) return "quota_exceeded";
  if (r.includes("invalid")) return "invalid_input";
  return "unknown";
}

const short = (v: unknown, n = 200) => (typeof v === "string" ? v.slice(0, n) : null);
const reqId = (v: unknown) => (typeof v === "number" || typeof v === "string" ? v : null);

export function createFonnteSender(opts: {
  token: string;
  apiUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): WhatsappSender {
  const apiUrl = opts.apiUrl ?? FONNTE_DEFAULT_API_URL;
  if (!apiUrl.startsWith("https://")) throw new Error("FONNTE_API_URL harus https");
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? FONNTE_TIMEOUT_MS;
  return {
    async send({ target, message }) {
      const body = new URLSearchParams({ target, message, countryCode: "0" });
      let res: Response;
      try {
        res = await doFetch(apiUrl, {
          method: "POST",
          headers: { Authorization: opts.token },
          body,
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        throw new FonnteError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
      }
      let json: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = await res.json();
        if (parsed && typeof parsed === "object") json = parsed as Record<string, unknown>;
      } catch {
        json = null;
      }
      if (!res.ok && !json) throw new FonnteError("http_error", { httpStatus: res.status });
      // Docs: contoh error token memakai "Status" (S besar) — terima keduanya.
      const status = json?.status ?? json?.Status;
      if (status !== true) {
        const reason = short(json?.reason);
        const code = mapFonnteReason(reason);
        throw new FonnteError(code === "unknown" && !res.ok ? "http_error" : code, {
          httpStatus: res.status,
          reason,
          requestid: reqId(json?.requestid),
        });
      }
      return {
        detail: short(json?.detail),
        id: Array.isArray(json?.id) ? json.id.map(String).slice(0, 10) : [],
        process: short(json?.process, 40),
        requestid: reqId(json?.requestid),
      };
    },
  };
}

/** Sender dari env (dibaca saat kirim; FONNTE_TOKEN wajib bila WHATSAPP_ENABLED). */
export function createEnvFonnteSender(fetchImpl?: typeof fetch): WhatsappSender {
  return {
    send(input) {
      const env = getEnv();
      return createFonnteSender({
        token: requireEnvValue(env, "FONNTE_TOKEN"),
        apiUrl: env.FONNTE_API_URL,
        fetch: fetchImpl,
      }).send(input);
    },
  };
}
