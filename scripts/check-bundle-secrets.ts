// P25 (T-48): `pnpm check:bundle-secrets` SETELAH `pnpm build`. Gagal (exit 1) bila nama secret
// atau NILAI secret dari environment build muncul di output yang disajikan ke browser.
// Nilai dibandingkan sebagai byte, tidak pernah dicetak. .env.local dimuat bila ada (lokal);
// di CI hanya env job yang diperiksa.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { clientFiles, scanFiles } from "./lib/bundle-scan";

config({ path: ".env.local", quiet: true });

const root = process.cwd();
const nextDir = resolve(root, ".next");
if (!existsSync(nextDir)) {
  console.error("Folder .next tidak ada — jalankan `pnpm build` dulu.");
  process.exit(1);
}
const files = clientFiles(nextDir);
if (files.length === 0) {
  console.error("Tidak ada file klien di .next/static — build tidak lengkap.");
  process.exit(1);
}
const findings = scanFiles(files, root, process.env);
if (findings.length) {
  for (const f of findings) {
    console.error(`${f.kind === "value" ? "NILAI secret" : "pola"} ${f.name} ditemukan di ${f.file}`);
  }
  console.error(`GAGAL: ${findings.length} temuan di ${files.length} file klien.`);
  process.exit(1);
}
console.log(`OK: ${files.length} file klien bersih dari pola & nilai secret.`);
