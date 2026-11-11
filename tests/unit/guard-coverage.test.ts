import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// P25 (T-48, security.md §3 & §9): META-TEST. Setiap export server action (`src/server/actions/**`)
// dan route handler (`src/app/**/route.ts`) WAJIB memanggil salah satu guard di bawah, atau
// tercantum di PUBLIC_ALLOWLIST beserta alasannya. File/handler baru tanpa guard → test gagal.
// Deteksi berbasis teks (statis): guard harus dipanggil di badan fungsi export itu sendiri.

const ROOT = process.cwd();

const GUARDS: Record<string, RegExp> = {
  admin: /\brequireAdmin(Api)?\(/,
  donor: /\brequireDonor\(/,
  // Verifikasi access token transaksi (hash SHA-256 dibandingkan di repository; diuji di bawah).
  transactionToken: /\b(getTransactionStatus|guestReceiptPdf|createPaymentForTransaction)\(/,
  // Signature QStash (createJobHandler → verifyQStashSignature; notify memakai createJobHandler).
  qstash: /\bcreate(Job|Notify)Handler\(/,
  // Signature webhook Midtrans (handleMidtransWebhook → provider.verifyWebhook).
  webhook: /\bhandleMidtransWebhook\(/,
};

/**
 * Endpoint yang SENGAJA publik. Kunci: `<path relatif>#<nama export>`. Menambah entri di sini
 * = keputusan keamanan; tulis alasannya.
 */
const PUBLIC_ALLOWLIST: Record<string, string> = {
  // Login admin: publik; rate limit 5/15 menit per IP+email + lockout DB (admin-auth-service).
  "src/server/actions/admin-auth-actions.ts#loginAdmin": "login admin",
  // Logout: hanya menghapus sesi milik cookie pemanggil.
  "src/server/actions/admin-auth-actions.ts#logoutAdmin": "logout admin (sesi sendiri)",
  // Auth.js: memulai OAuth Google / keluar dari sesi sendiri.
  "src/server/actions/auth-actions.ts#signInWithGoogle": "login donor (Auth.js)",
  "src/server/actions/auth-actions.ts#signOutDonor": "logout donor (sesi sendiri)",
  // Data campaign publik (published saja), Zod + paging terbatas.
  "src/server/actions/campaign-list-actions.ts#loadMoreCampaigns": "daftar campaign publik",
  // Checkout tamu (F-04): rate limit per IP + honeypot + Zod di donation-service.
  "src/server/actions/donations.ts#createDonationAction": "checkout publik",
  // Health check tanpa data.
  "src/app/api/health/route.ts#GET": "health check",
  // Handler Auth.js (CSRF & state OAuth dikelola Auth.js).
  "src/app/api/auth/[...nextauth]/route.ts#GET": "Auth.js",
  "src/app/api/auth/[...nextauth]/route.ts#POST": "Auth.js",
  // Upload lokal HANYA APP_ENV=development (404 di luar itu), nama file acak tervalidasi regex.
  "src/app/api/dev-uploads/[file]/route.ts#GET": "upload lokal dev",
};

/** Export konfigurasi route segment yang bukan handler. */
const CONFIG_EXPORTS = new Set(["maxDuration", "dynamic", "revalidate", "fetchCache", "runtime", "preferredRegion"]);

function walk(dir: string, pick: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, pick, out);
    else if (pick(p)) out.push(p);
  }
  return out;
}

/** Export bernilai (fungsi/const) beserta teks badannya sampai export berikutnya / akhir file. */
export function exportedBodies(src: string): { name: string; body: string }[] {
  const re = /^export\s+(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)|const\s+\{([^}]+)\})/gm;
  const hits = [...src.matchAll(re)];
  return hits.flatMap((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1]!.index : src.length;
    const body = src.slice(m.index, end);
    const names = m[3] ? m[3].split(",").map((s) => s.split(":").pop()!.trim()).filter(Boolean) : [m[1] ?? m[2]!];
    return names.map((name) => ({ name, body }));
  });
}

const actionFiles = walk(join(ROOT, "src/server/actions"), (p) => /\.tsx?$/.test(p));
const routeFiles = walk(join(ROOT, "src/app"), (p) => /[\\/]route\.ts$/.test(p));

describe("meta-test guard server action & route handler", () => {
  it("menemukan file (sanity)", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(10);
    expect(routeFiles.length).toBeGreaterThanOrEqual(16);
  });

  it("server action hanya di src/server/actions ('use server' di tempat lain dilarang)", () => {
    const stray = walk(join(ROOT, "src"), (p) => /\.tsx?$/.test(p))
      .filter((p) => !p.startsWith(join(ROOT, "src/server/actions")))
      .filter((p) => /^\s*["']use server["']/m.test(readFileSync(p, "utf8")))
      .map((p) => relative(ROOT, p));
    expect(stray).toEqual([]);
  });

  it("setiap file action diawali 'use server'", () => {
    for (const f of actionFiles) expect(readFileSync(f, "utf8"), relative(ROOT, f)).toMatch(/^["']use server["'];/);
  });

  const seen = new Set<string>();
  for (const file of [...actionFiles, ...routeFiles]) {
    const rel = relative(ROOT, file);
    for (const { name, body } of exportedBodies(readFileSync(file, "utf8"))) {
      if (CONFIG_EXPORTS.has(name)) continue;
      const key = `${rel}#${name}`;
      seen.add(key);
      it(`${key} terlindungi guard atau di allowlist`, () => {
        const guards = Object.entries(GUARDS).filter(([, re]) => re.test(body)).map(([g]) => g);
        if (key in PUBLIC_ALLOWLIST) {
          // Endpoint publik yang ternyata sudah ber-guard → keluarkan dari allowlist.
          expect(guards, `${key} ber-guard; hapus dari PUBLIC_ALLOWLIST`).toEqual([]);
          return;
        }
        expect(guards.length, `${key}: tidak ada guard (requireAdmin/requireDonor/token/QStash/webhook)`).toBeGreaterThan(0);
      });
    }
  }

  it("allowlist tidak memuat entri basi", () => {
    expect(Object.keys(PUBLIC_ALLOWLIST).filter((k) => !seen.has(k))).toEqual([]);
  });

  it("deteksi export bekerja (export tanpa guard tertangkap)", () => {
    const fake = `"use server";\nexport async function bocor() { return db.select(); }\nexport async function aman() { await requireAdmin("x"); }\n`;
    const r = exportedBodies(fake).map(({ name, body }) => [name, Object.values(GUARDS).some((re) => re.test(body))]);
    expect(r).toEqual([["bocor", false], ["aman", true]]);
  });

  it("guard tidak langsung benar-benar memverifikasi (rantai ke implementasi)", () => {
    const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
    expect(read("src/lib/jobs/job-route.ts")).toMatch(/deps\.verify \?\? verifyQStashSignature/);
    expect(read("src/server/services/notifications/notify-handler.ts")).toMatch(/\bcreateJobHandler\(/);
    expect(read("src/lib/payments/webhook/midtrans-webhook.ts")).toMatch(/provider\.verifyWebhook\(/);
    const svc = read("src/server/services/payment-service.ts") + read("src/server/services/receipt-service.ts");
    for (const fn of ["getTransactionStatus", "guestReceiptPdf", "createPaymentForTransaction"]) {
      const body = exportedBodies(svc).find((e) => e.name === fn)?.body ?? "";
      expect(body, fn).toMatch(/sha256\(/);
    }
  });
});
