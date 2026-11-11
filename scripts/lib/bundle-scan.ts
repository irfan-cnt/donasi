// P25 (T-48): pemindai output build yang dikirim ke browser. Murni (fs saja); dipakai
// scripts/check-bundle-secrets.ts dan tests/unit/bundle-scan.test.ts. Nilai secret TIDAK PERNAH
// dicetak: hasil hanya menyebut nama variabel/pola dan path file.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Pola nama/prefix yang tidak boleh muncul di aset klien (CLAUDE.md, security.md §6). */
export const FORBIDDEN_PATTERNS = [
  "SB-Mid-server",
  "Mid-server",
  "MIDTRANS_SERVER_KEY",
  "GMAIL",
  "FONNTE",
  "DATABASE_URL",
  "AUTH_SECRET",
  "QSTASH_",
  "APP_ENCRYPTION_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "VERCEL_AUTOMATION_BYPASS_SECRET",
] as const;

/** Variabel env yang NILAINYA dicari (bila ada di environment build). */
export const SECRET_ENV_VARS = [
  "MIDTRANS_SERVER_KEY",
  "GMAIL_APP_PASSWORD",
  "FONNTE_TOKEN",
  "AUTH_SECRET",
  "AUTH_GOOGLE_SECRET",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "APP_ENCRYPTION_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "VERCEL_AUTOMATION_BYPASS_SECRET",
  "PREVIEW_TOKEN_SECRET",
] as const;

/** Nilai pendek/kosong diabaikan (terlalu umum untuk dicari tanpa false positive). */
export const MIN_SECRET_LENGTH = 12;

const CLIENT_EXT = /\.(js|mjs|css|html|rsc|json|txt|map|body|meta|webmanifest|xml)$/;

/** File yang disajikan ke klien: `.next/static/**` dan output prerender `.next/server/app/**` (html/rsc/body). */
export function clientFiles(nextDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, filter: (p: string) => boolean) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, filter);
      else if (filter(p)) out.push(p);
    }
  };
  walk(join(nextDir, "static"), (p) => CLIENT_EXT.test(p));
  walk(join(nextDir, "server", "app"), (p) => /\.(html|rsc|body|segments)$/.test(p) || /\.segments[\\/]/.test(p));
  return out;
}

export type Finding = { file: string; kind: "pattern" | "value"; name: string };

export function scanFiles(
  files: string[],
  root: string,
  env: Record<string, string | undefined>,
): Finding[] {
  const findings: Finding[] = [];
  const values = SECRET_ENV_VARS.flatMap((name) => {
    const v = env[name]?.trim();
    return v && v.length >= MIN_SECRET_LENGTH ? [{ name, buf: Buffer.from(v) }] : [];
  });
  const patterns = FORBIDDEN_PATTERNS.map((name) => ({ name, buf: Buffer.from(name) }));
  for (const file of files) {
    const data = readFileSync(file);
    const rel = relative(root, file);
    for (const p of patterns) if (data.includes(p.buf)) findings.push({ file: rel, kind: "pattern", name: p.name });
    for (const v of values) if (data.includes(v.buf)) findings.push({ file: rel, kind: "value", name: v.name });
  }
  return findings;
}
