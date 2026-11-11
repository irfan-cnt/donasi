// Render semua gambar Instagram: node marketing/instagram/assets/src/render.mjs [ID ...]
// Tanpa argumen = render semua + contact-sheet. Dengan argumen = hanya ID tersebut (mis. IG-CR-01-S3).
// Memakai Playwright/Chromium yang sudah terpasang di repo; tanpa server, tanpa jaringan.
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(SRC, '..');
const TEMPLATE = pathToFileURL(path.join(SRC, 'template.html')).href;
const only = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1, colorScheme: 'light' });
page.on('pageerror', (e) => { console.error('Galat halaman:', e.message); process.exitCode = 1; });

async function load(id) {
  await page.goto(`${TEMPLATE}?id=${encodeURIComponent(id || '')}`);
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('800 40px Jakarta'), document.fonts.load('600 40px Fraunces')]);
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
  });
}

await load('');
const entries = await page.evaluate(() => window.IG_ENTRIES.map(({ id, out, w, h, draft, note, group }) => ({ id, out, w, h, draft, note, group })));
const fontsOk = await page.evaluate(() => document.fonts.check('800 40px Jakarta') && document.fonts.check('600 40px Fraunces'));
if (!fontsOk) throw new Error('Font lokal gagal dimuat (cek src/fonts/).');

for (const e of entries) {
  if (only.length && !only.includes(e.id)) continue;
  await page.setViewportSize({ width: e.w, height: e.h });
  await load(e.id);
  const overflow = await page.evaluate(() => {
    // peringatan bila ada teks yang meluber dari kanvas
    const cv = document.querySelector('.cv').getBoundingClientRect();
    return [...document.querySelectorAll('.cv *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return el.closest('.motif, .bigstar, .art, .stage, .photo.top') === null && r.width > 0 && (r.right > cv.right + 1 || r.bottom > cv.bottom + 1 || r.left < cv.left - 1);
    }).map((el) => el.className || el.tagName).slice(0, 5);
  });
  const file = path.join(OUT, e.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.locator('.cv').screenshot({ path: file, animations: 'disabled' });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`${e.draft ? 'perlu data ' : 'siap unggah'}  ${e.out}  ${e.w}×${e.h}  ${kb} KB${overflow.length ? '  ⚠ meluber: ' + overflow.join(', ') : ''}`);
}

// contact sheet
if (!only.length) {
  const cells = entries.map((e) => `<figure><img src="${pathToFileURL(path.join(OUT, e.out)).href}" style="aspect-ratio:${e.w}/${e.h}"><figcaption>${e.id}${e.draft ? ' · <b>perlu data</b>' : ''}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><style>
    body{margin:0;background:#E9EDE9;font-family:Jakarta,sans-serif;padding:40px;width:${7 * 300 + 6 * 24 + 80}px}
    h1{margin:0 0 28px;font-size:34px;color:#053F1E} .g{display:grid;grid-template-columns:repeat(7,300px);gap:28px 24px;align-items:end}
    figure{margin:0} img{width:300px;display:block;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.12);object-fit:contain;background:#fff}
    figcaption{font-size:17px;font-weight:700;color:#17201C;margin-top:8px} b{color:#A35200}</style>
    <h1>Tebar Kebaikan — aset Instagram (${entries.length} gambar)</h1><div class="g">${cells}</div>`;
  const tmp = path.join(SRC, '.contact-sheet.html');
  fs.writeFileSync(tmp, html);
  await page.setViewportSize({ width: 7 * 300 + 6 * 24 + 80, height: 800 });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('load');
  await page.screenshot({ path: path.join(OUT, 'contact-sheet.png'), fullPage: true });
  fs.unlinkSync(tmp);
  fs.writeFileSync(path.join(SRC, 'status.json'), JSON.stringify(entries.map(({ id, out, w, h, draft, note }) => ({ id, out, size: `${w}x${h}`, status: draft ? 'perlu data' : 'siap unggah', note })), null, 2) + '\n');
  console.log('contact-sheet.png + src/status.json ditulis.');
}
await browser.close();
