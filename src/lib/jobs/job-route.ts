import "server-only";
import { requestLogger, type Logger } from "@/lib/logger";
import { verifyQStashSignature } from "@/lib/qstash";
import { acquireLock, releaseLock } from "@/lib/redis";
import { siteUrl } from "@/lib/site";

// Pembungkus route /api/jobs/* (P14): verifikasi signature QStash WAJIB di semua environment
// (tanpa bypass env), lock anti-tumpang-tindih, respons tanpa data sensitif.
// Uji memakai verifier yang di-inject lewat `createJobHandler(…, { verify })` — route
// produksi selalu memakai `verifyQStashSignature` (Receiver + QSTASH_*_SIGNING_KEY).

export const MAX_JOB_BODY_BYTES = 4096;

/** true bila signature valid. Tidak boleh melempar untuk input buruk. */
export type SignatureVerifier = (
  signature: string | null,
  rawBody: string,
  url: string,
) => Promise<boolean>;

export interface JobLock {
  acquire(name: string, ttlMs: number): Promise<string | null>;
  release(name: string, owner: string): Promise<void>;
}

export interface JobContext {
  log: Logger;
  /** Body JSON (sudah terverifikasi) atau null bila kosong/bukan JSON. */
  body: unknown;
  /** Batas waktu kerja (epoch ms) agar job berhenti sebelum timeout fungsi. */
  deadline: number;
}

export interface JobOptions {
  /** Lama lock (ms); harus > durasi maksimum job. */
  lockTtlMs: number;
  /** Anggaran waktu kerja (ms). */
  budgetMs: number;
  /**
   * Nama lock dari body terverifikasi (default `job:{name}`). Dipakai job per-pesan (notify, P16)
   * agar pesan berbeda tidak saling melewati, sementara pesan kembar tetap diserialkan.
   */
  lockName?: (body: unknown) => string;
}

export interface JobDeps {
  verify?: SignatureVerifier;
  lock?: JobLock;
  now?: () => number;
}

const HEADERS = { "Cache-Control": "no-store" };
const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: HEADERS });

/** L3: hanya nama kelas + kode error (mis. SQLSTATE / kode Midtrans), tanpa pesan mentah. */
function safeError(e: unknown): string {
  const name = e instanceof Error ? e.name : "unknown";
  const code =
    e && typeof e === "object" && "code" in e && typeof e.code === "string" ? `:${e.code}` : "";
  return `${name}${code}`;
}

const defaultLock: JobLock = { acquire: acquireLock, release: releaseLock };

/** Baca body dengan batas byte (stream). null = melebihi batas. */
async function readLimited(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? "0") > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Handler POST untuk job QStash. Urutan: body (≤4 KB) → signature (URL kanonik APP_URL +
 * path; tanpa signature → 401) → lock `job:{name}` (terkunci → 200 `skipped`) → `run`.
 * Error job → 500 (QStash mencoba ulang; semua job idempoten).
 */
export function createJobHandler(
  name: string,
  options: JobOptions,
  run: (ctx: JobContext) => Promise<Record<string, unknown>>,
  deps: JobDeps = {},
): (request: Request) => Promise<Response> {
  const verify = deps.verify ?? verifyQStashSignature;
  const lock = deps.lock ?? defaultLock;
  const now = deps.now ?? Date.now;

  return async (request: Request) => {
    const log = requestLogger(request.headers.get("x-request-id")).child({ job: name });
    let rawBody: string | null;
    try {
      rawBody = await readLimited(request, MAX_JOB_BODY_BYTES);
    } catch {
      return json(400, { ok: false, result: "unreadable_body" });
    }
    if (rawBody === null) return json(413, { ok: false, result: "payload_too_large" });

    const signature = request.headers.get("upstash-signature");
    const url = `${siteUrl()}${new URL(request.url).pathname}`;
    let valid = false;
    try {
      valid = !!signature && (await verify(signature, rawBody, url));
    } catch (error) {
      // mis. signing key belum diisi: tetap tolak (fail-closed), tanpa detail ke klien.
      log.error("job: verifikasi signature gagal", {
        error: safeError(error),
      });
    }
    if (!valid) {
      log.warn("job: signature QStash tidak valid / tidak ada", { hasSignature: !!signature });
      return json(401, { ok: false, result: "invalid_signature" });
    }

    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = null;
      }
    }

    const lockName = options.lockName?.(body) ?? `job:${name}`;
    let owner: string | null;
    try {
      owner = await lock.acquire(lockName, options.lockTtlMs);
    } catch (error) {
      log.error("job: lock tidak tersedia", { error: safeError(error) });
      return json(503, { ok: false, result: "lock_unavailable" });
    }
    if (!owner) {
      log.info("job: masih berjalan (lock), dilewati");
      return json(200, { ok: true, result: "skipped", reason: "locked" });
    }

    const started = now();
    try {
      const summary = await run({ log, body, deadline: started + options.budgetMs });
      log.info("job: selesai", { durationMs: now() - started, ...summary });
      return json(200, { ok: true, result: "done", ...summary });
    } catch (error) {
      log.error("job: gagal", {
        error: safeError(error),
      });
      return json(500, { ok: false, result: "error" });
    } finally {
      await lock.release(lockName, owner).catch((error: unknown) => {
        log.warn("job: gagal melepas lock", { error: safeError(error) });
      });
    }
  };
}
