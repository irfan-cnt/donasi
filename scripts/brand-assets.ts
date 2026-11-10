/**
 * Regenerasi aset merek dari sumber milik PM di assets/brand-src/.
 *
 *   pnpm brand:assets
 *
 * Keluaran:
 *   public/brand/logo-wide-{40,56}[@2x].{png,webp}  logo lebar (tinggi tampilan 40/56 px)
 *   public/brand/logo-icon-{64,128}.png              ikon persegi (UI ringkas)
 *   public/brand/logo-email.png                      logo email (PNG 2x untuk tinggi 36 px)
 *   public/brand/og-default.png                      Open Graph default 1200×630
 *   public/brand/icon-{192,512}.png                  ikon web manifest
 *   src/app/icon.png (512) · src/app/apple-icon.png (180) · src/app/favicon.ico (32+48)
 *   src/lib/pdf/brand/logo-wide.png                  logo untuk PDF (dibundel, tanpa fetch)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const SRC_WIDE = join(ROOT, "assets/brand-src/logo-wide.png");
const SRC_ICON = join(ROOT, "assets/brand-src/logo-icon.png");
const OUT = join(ROOT, "public/brand");
const BG = "#FAF9F5";
const PRIMARY_INK = "#053F1E";
const ORANGE = "#F89808";

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

function out(path: string, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`✓ ${path.replace(`${ROOT}/`, "")} (${(buf.length / 1024).toFixed(1)} KB)`);
}

/** Sumber yang sudah di-trim (buang margin transparan). */
async function trimmed(src: string) {
  return sharp(await sharp(src).trim({ threshold: 10 }).png().toBuffer());
}

/** Ikon dipadatkan ke kanvas persegi (transparan) dengan padding relatif. */
async function squareIcon(size: number, padRatio: number, background = TRANSPARENT) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const art = await (
    await trimmed(SRC_ICON)
  )
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, gravity: "centre" }])
    .png({ compressionLevel: 9, palette: true, quality: 95 })
    .toBuffer();
}

/** ICO berisi entri PNG (didukung semua peramban modern). */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  const wide = await trimmed(SRC_WIDE);
  const meta = await wide.metadata();
  const ratio = meta.width! / meta.height!;
  console.log(`logo lebar setelah trim: ${meta.width}×${meta.height} (rasio ${ratio.toFixed(3)})`);

  // Logo lebar 1x/2x untuk tinggi tampilan 40 & 56 px.
  for (const h of [40, 56]) {
    for (const scale of [1, 2]) {
      const height = h * scale;
      const width = Math.round(height * ratio);
      const suffix = scale === 2 ? "@2x" : "";
      const base = wide.clone().resize(width, height, { fit: "fill" });
      out(
        join(OUT, `logo-wide-${h}${suffix}.png`),
        await base.clone().png({ compressionLevel: 9, palette: true, quality: 95 }).toBuffer(),
      );
      out(
        join(OUT, `logo-wide-${h}${suffix}.webp`),
        await base.clone().webp({ quality: 90, alphaQuality: 100 }).toBuffer(),
      );
    }
  }
  console.log(
    `dimensi tampilan: 40 → ${Math.round(40 * ratio)}×40, 56 → ${Math.round(56 * ratio)}×56`,
  );

  // Email: PNG (bukan WebP), 2x untuk tinggi 36 px.
  out(
    join(OUT, "logo-email.png"),
    await wide.clone().resize({ height: 72 }).png({ compressionLevel: 9 }).toBuffer(),
  );

  // PDF: dibundel di samping font, dibaca dari disk saat render.
  out(
    join(ROOT, "src/lib/pdf/brand/logo-wide.png"),
    await wide.clone().resize({ height: 96 }).png({ compressionLevel: 9 }).toBuffer(),
  );

  // Ikon UI ringkas.
  for (const s of [64, 128]) out(join(OUT, `logo-icon-${s}.png`), await squareIcon(s, 0.02));

  // Ikon aplikasi (file convention Next + manifest).
  out(join(ROOT, "src/app/icon.png"), await squareIcon(512, 0.04));
  out(
    join(ROOT, "src/app/apple-icon.png"),
    await squareIcon(180, 0.1, { r: 255, g: 255, b: 255, alpha: 1 }),
  );
  out(join(OUT, "icon-192.png"), await squareIcon(192, 0.04));
  out(join(OUT, "icon-512.png"), await squareIcon(512, 0.04));
  out(
    join(ROOT, "src/app/favicon.ico"),
    buildIco([
      { size: 32, png: await squareIcon(32, 0) },
      { size: 48, png: await squareIcon(48, 0) },
    ]),
  );

  // Open Graph default: logo di tengah, latar krem + pita hijau/oranye.
  const W = 1200;
  const H = 630;
  const logoW = 860;
  const logo = await wide.clone().resize({ width: logoW }).png().toBuffer();
  const logoH = (await sharp(logo).metadata()).height!;
  const deco = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${BG}"/>
      <rect y="${H - 56}" width="${W}" height="56" fill="${PRIMARY_INK}"/>
      <rect y="${H - 64}" width="${W}" height="8" fill="${ORANGE}"/>
    </svg>`,
  );
  out(
    join(OUT, "og-default.png"),
    await sharp(deco)
      .composite([
        { input: logo, left: Math.round((W - logoW) / 2), top: Math.round((H - 64 - logoH) / 2) },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
