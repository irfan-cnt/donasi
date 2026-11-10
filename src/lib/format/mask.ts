// Masking PII untuk admin tanpa permission `donors.export` (P22, F-28). Dilakukan di SERVER
// sebelum data dikirim ke browser/CSV — nilai penuh tidak pernah keluar. Modul murni.

/** "budi.santoso@gmail.com" → "bu***@g***.com". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, Math.min(2, Math.max(1, user.length - 1)))}***@${host.slice(0, 1)}***${tld}`;
}

/** "+6281234567890" → "+62812****7890" (4 digit terakhir + prefix operator). */
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return "****";
  return `${phone.slice(0, 6)}****${phone.slice(-4)}`;
}

export function maskIf<T extends string | null>(value: T, mask: boolean, fn: (v: string) => string): T {
  return (value !== null && mask ? fn(value) : value) as T;
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Nomor Indonesia: +62…, 62…, 08… (boleh berspasi/tanda hubung). */
const PHONE_IN_TEXT = /(?:\+?62|0)8[\d\s-]{7,16}\d/g;

/** true bila kata kunci berbentuk email atau nomor WA (jangan disimpan di audit). */
export function looksLikePii(q: string): boolean {
  return q.includes("@") || new RegExp(PHONE_IN_TEXT.source).test(q) || /^[+\d\s-]{8,20}$/.test(q.trim());
}

/** Samarkan email/nomor WA di dalam teks. */
export function maskPiiText(text: string): string {
  return text
    .replace(EMAIL_IN_TEXT, (m) => maskEmail(m))
    .replace(PHONE_IN_TEXT, (m) => {
      const digits = m.replace(/\D/g, "");
      return maskPhone(`+${digits.startsWith("0") ? `62${digits.slice(1)}` : digits}`);
    });
}

/** Samarkan email/WA di seluruh nilai JSON (rekursif). Dipakai server sebelum render. */
export function maskPiiDeep(value: unknown): unknown {
  if (typeof value === "string") return maskPiiText(value);
  if (Array.isArray(value)) return value.map(maskPiiDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskPiiDeep(v)]));
  }
  return value;
}
