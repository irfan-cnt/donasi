import { escapeHtml } from "./template";

// Layout email bawaan (T-29): HTML responsif berbasis tabel + inline style (klien email tidak
// memuat CSS eksternal), plus versi teks. Warna dari design tokens (src/app/globals.css).

export const EMAIL_BRAND = {
  primary: "#086828",
  primarySoft: "#E6F4EA",
  primaryInk: "#053F1E",
  gold: "#A35200",
  orange: "#F89808",
  bg: "#F3F1EB",
  border: "#E5E2D9",
  ink: "#17201C",
  inkSoft: "#4A5550",
  inkFaint: "#78827D",
} as const;

/** Logo email: PNG (bukan WebP) dari public/brand, URL absolut dari APP_URL. Alt = nama org. */
export const EMAIL_LOGO_PATH = "/brand/logo-email.png";
export const EMAIL_LOGO = { width: 184, height: 36 } as const;

export interface EmailOrganization {
  name: string;
  address: string;
  siteUrl: string;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/g;

/** Teks (sudah dirender, BELUM di-escape) → HTML aman: escape, tautkan URL situs sendiri, \n → <br>. */
export function textToHtml(text: string, siteUrl: string): string {
  const linkify = (para: string) => {
    let out = "";
    let last = 0;
    for (const m of para.matchAll(URL_IN_TEXT)) {
      out += escapeHtml(para.slice(last, m.index));
      const url = m[0];
      const safe = escapeHtml(url);
      // Hanya URL situs sendiri yang menjadi tautan; selain itu teks biasa (anti-phishing).
      out +=
        url === siteUrl || url.startsWith(`${siteUrl}/`)
          ? `<a href="${safe}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;word-break:break-all">${safe}</a>`
          : safe;
      last = m.index + url.length;
    }
    return (out + escapeHtml(para.slice(last))).replace(/\n/g, "<br>");
  };
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px 0">${linkify(para)}</p>`)
    .join("\n");
}

/** Bungkus isi email dengan layout bawaan. `subject` & `body` adalah teks hasil render (tanpa HTML). */
export function renderEmailLayout(input: {
  subject: string;
  body: string;
  org: EmailOrganization;
  /** Teks kecil di footer (mis. alasan email dikirim). */
  footerNote?: string;
}): { html: string; text: string } {
  const { org } = input;
  const b = EMAIL_BRAND;
  const note =
    input.footerNote ??
    "Email ini dikirim otomatis karena Anda berdonasi melalui situs kami. Mohon tidak membalas email ini.";
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.subject)}</title>
<style>
@media only screen and (max-width:620px){.tk-container{width:100%!important}.tk-pad{padding:20px 16px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${b.bg};color:${b.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${b.bg}">
<tr><td align="center" style="padding:24px 8px">
<table role="presentation" class="tk-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${b.border};border-radius:12px;overflow:hidden">
<tr><td class="tk-pad" style="background:#FFFFFF;border-bottom:4px solid ${b.orange};padding:20px 32px">
<a href="${escapeHtml(org.siteUrl)}" style="color:${b.primary};text-decoration:none;font-size:20px;font-weight:bold;letter-spacing:.3px">
<img src="${escapeHtml(`${org.siteUrl.replace(/\/+$/, "")}${EMAIL_LOGO_PATH}`)}" width="${EMAIL_LOGO.width}" height="${EMAIL_LOGO.height}" alt="${escapeHtml(org.name)}" style="display:block;border:0;outline:none;width:${EMAIL_LOGO.width}px;height:${EMAIL_LOGO.height}px;color:${b.primary};font-size:20px;font-weight:bold"></a>
</td></tr>
<tr><td class="tk-pad" style="padding:32px;font-size:15px;line-height:1.6;color:${b.ink}">
<h1 style="margin:0 0 20px 0;font-size:20px;line-height:1.35;color:${b.primaryInk}">${escapeHtml(input.subject)}</h1>
${textToHtml(input.body, org.siteUrl)}
</td></tr>
<tr><td class="tk-pad" style="background:${b.primarySoft};padding:20px 32px;font-size:12px;line-height:1.5;color:${b.inkSoft}">
<strong style="color:${b.primaryInk}">${escapeHtml(org.name)}</strong><br>
${escapeHtml(org.address).replace(/\n/g, "<br>")}<br>
<a href="${escapeHtml(org.siteUrl)}" style="color:${b.primary}">${escapeHtml(org.siteUrl.replace(/^https?:\/\//, ""))}</a>
<p style="margin:12px 0 0 0;color:${b.inkFaint}">${escapeHtml(note)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = `${input.body.trim()}\n\n--\n${org.name}\n${org.address}\n${org.siteUrl}\n\n${note}\n`;
  return { html, text };
}
