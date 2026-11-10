// Uji manual kanal WhatsApp (P17): kirim SATU pesan uji tetap lewat klien Fonnte aplikasi.
//   pnpm wa:test --to 0812xxxxxxxx --yes
// Wajib --to (nomor tujuan yang sudah dikonfirmasi PM) dan --yes. Ditolak bila APP_ENV=production.
// Opsi --env-file=<path> (default .env.local). Token tidak pernah dicetak.
import { config } from "dotenv";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const value = (name: string) => {
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

config({ path: value("--env-file") ?? ".env.local", quiet: true });

async function main() {
  if ((process.env.APP_ENV ?? "development") === "production") {
    throw new Error("Ditolak: APP_ENV=production. Skrip ini hanya untuk development/preview.");
  }
  const to = value("--to");
  if (!to || to.startsWith("--")) throw new Error("Wajib --to <nomor WhatsApp tujuan>.");
  if (!flag("--yes")) {
    throw new Error("Wajib --yes untuk benar-benar mengirim (pastikan nomor sudah dikonfirmasi).");
  }
  const token = process.env.FONNTE_TOKEN;
  if (!token) throw new Error("FONNTE_TOKEN belum diisi.");

  const { createFonnteSender, toFonnteTarget, FONNTE_DEFAULT_API_URL } = await import(
    "../src/lib/whatsapp/fonnte"
  );
  const target = toFonnteTarget(to);
  if (!target) throw new Error("Nomor tidak valid (nomor seluler Indonesia, mis. 0812… / +62812…).");
  const sender = createFonnteSender({
    token,
    apiUrl: process.env.FONNTE_API_URL || FONNTE_DEFAULT_API_URL,
  });
  const env = process.env.APP_ENV ?? "development";
  const message = `[Tebar Kebaikan] Pesan uji WhatsApp (${env}). Abaikan pesan ini.`;
  console.log(`Mengirim 1 pesan uji ke ${target.slice(0, 5)}****${target.slice(-3)} …`);
  const res = await sender.send({ target, message });
  console.log("Berhasil:", JSON.stringify(res));
}

main().catch((e: unknown) => {
  const rec = (e ?? {}) as { code?: string; response?: unknown; message?: string };
  const detail = rec.response ? JSON.stringify(rec.response) : "";
  console.error("Gagal:", rec.code ?? rec.message ?? "unknown", detail);
  process.exit(1);
});
