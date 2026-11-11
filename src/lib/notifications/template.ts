// Template engine notifikasi (T-28, notification-architecture.md §Template): substitusi
// {{variabel}} dengan whitelist. Tanpa logika/eksekusi kode. Murni — dipakai handler & admin (P23).

export const TEMPLATE_VARIABLES = [
  "donor_name",
  "donor_email",
  "donor_phone",
  "campaign_title",
  "transaction_id",
  "donation_amount",
  "payment_method",
  "payment_status",
  "payment_url",
  "payment_instruction",
  "created_at",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateVars = Partial<Record<TemplateVariable, string>>;

const ALLOWED = new Set<string>(TEMPLATE_VARIABLES);
/** Semua bentuk `{{ … }}` (termasuk yang cacat) agar validasi tidak bisa diakali. */
const ANY_PLACEHOLDER = /\{\{([^{}]*)\}\}/g;
const NAME = /^\s*([a-z_]+)\s*$/;
export const MAX_SUBJECT = 200;
export const MAX_BODY = 5000;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** Label variabel untuk editor admin (P23). */
export const TEMPLATE_VARIABLE_LABELS: Record<TemplateVariable, string> = {
  donor_name: "Nama donatur",
  donor_email: "Email donatur",
  donor_phone: "Nomor WhatsApp donatur",
  campaign_title: "Judul campaign",
  transaction_id: "Kode transaksi",
  donation_amount: "Nominal donasi",
  payment_method: "Metode pembayaran",
  payment_status: "Status pembayaran",
  payment_url: "Tautan status transaksi",
  payment_instruction: "Instruksi pembayaran",
  created_at: "Waktu transaksi",
};

/** Data contoh pratinjau & kirim tes (P23). Fiktif — tidak pernah data donatur nyata. */
export const SAMPLE_VARS: Required<TemplateVars> = {
  donor_name: "Ahmad Fauzi",
  donor_email: "ahmad.fauzi@contoh.id",
  donor_phone: "+6281200000000",
  campaign_title: "Sumur Bor untuk 300 Keluarga di Desa Oebelo, NTT",
  transaction_id: "TK-261109-7QF3KD",
  donation_amount: "Rp100.000",
  payment_method: "BCA Virtual Account",
  payment_status: "Berhasil",
  payment_url: "https://contoh.id/transaksi/TK-261109-7QF3KD/menunggu",
  payment_instruction: "Nomor Virtual Account: 1234 5678 9012 3456\nNominal: Rp100.000",
  created_at: "9 November 2026 pukul 10.15 WIB",
};

export interface TemplateValidation {
  ok: boolean;
  /** Placeholder yang tidak ada di whitelist (apa adanya, dipangkas). */
  unknown: string[];
  errors: string[];
}

/** Validasi saat simpan (admin P23): semua `{{…}}` wajib di whitelist; subject wajib untuk email. */
export function validateTemplate(input: {
  channel: "email" | "whatsapp";
  subject?: string | null;
  body: string;
}): TemplateValidation {
  const errors: string[] = [];
  const unknown = new Set<string>();
  const parts = [input.body, input.subject ?? ""];
  for (const part of parts) {
    for (const m of part.matchAll(ANY_PLACEHOLDER)) {
      const name = NAME.exec(m[1]!)?.[1];
      if (!name || !ALLOWED.has(name)) unknown.add(m[1]!.trim());
    }
    // `{{` tanpa pasangan / bersarang juga ditolak.
    const stripped = part.replace(ANY_PLACEHOLDER, "");
    if (stripped.includes("{{") || stripped.includes("}}")) errors.push("Kurung kurawal {{ }} tidak berpasangan");
  }
  if (unknown.size) errors.push(`Variabel tidak dikenal: ${[...unknown].join(", ")}`);
  if (!input.body.trim()) errors.push("Isi template wajib diisi");
  if (input.body.length > MAX_BODY) errors.push(`Isi maksimal ${MAX_BODY} karakter`);
  if (input.channel === "email") {
    if (!input.subject?.trim()) errors.push("Subjek wajib untuk email");
    else if (input.subject.length > MAX_SUBJECT) errors.push(`Subjek maksimal ${MAX_SUBJECT} karakter`);
    // P23: header injection — subjek satu baris.
    else if (/[\r\n]/.test(input.subject)) errors.push("Subjek tidak boleh berisi baris baru");
  }
  return { ok: errors.length === 0, unknown: [...unknown], errors: [...new Set(errors)] };
}

/** Validasi per field (pesan error untuk subjek vs isi) — aturan sama dengan validateTemplate. */
export function validateTemplateFields(input: {
  channel: "email" | "whatsapp";
  subject?: string | null;
  body: string;
}): { ok: boolean; subject: string[]; body: string[] } {
  if (validateTemplate(input).ok) return { ok: true, subject: [], body: [] };
  const body = validateTemplate({ channel: "whatsapp", body: input.body }).errors;
  const subject =
    input.channel === "email"
      ? [
          ...validateTemplate({ channel: "whatsapp", subject: input.subject ?? "", body: "x" }).errors,
          ...validateTemplate({ channel: "email", subject: input.subject, body: "x" }).errors.filter((e) => e.startsWith("Subjek")),
        ]
      : [];
  return { ok: false, subject: [...new Set(subject)], body };
}

/**
 * Isi placeholder. `escape: true` → nilai di-escape HTML (teks statis template TIDAK disentuh).
 * Variabel tak dikenal/kosong → "" (validasi simpan sudah menolak variabel tak dikenal).
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
  opts: { escape?: boolean } = {},
): string {
  return template.replace(ANY_PLACEHOLDER, (_m, inner: string) => {
    const name = NAME.exec(inner)?.[1];
    const value = name && ALLOWED.has(name) ? (vars[name as TemplateVariable] ?? "") : "";
    return opts.escape ? escapeHtml(value) : value;
  });
}

/** Subjek email: satu baris (cegah header injection), dipangkas. */
export function renderSubject(template: string, vars: TemplateVars): string {
  return renderTemplate(template, vars)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_SUBJECT);
}

// Token akses di URL (?t=, ?token=, access_token, …) → *** sebelum payload disimpan ke log.
const URL_TOKEN = /((?:[?&#]|%3F|%26)(?:t|token|access_token|code_verifier|signature)(?:=|%3D))[^&#\s"'<>]+/gi;

export function redactTokens(text: string): string {
  return text.replace(URL_TOKEN, "$1***");
}

/** Payload untuk notification_logs.request_payload: semua nilai disamarkan token-nya. */
export function redactPayload(vars: TemplateVars): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) continue;
    out[k] = /token|secret|password/i.test(k) ? "***" : redactTokens(v);
  }
  return out;
}
