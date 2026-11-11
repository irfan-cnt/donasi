/**
 * Ringkasan error yang aman untuk log (P25, L11): nama kelas + kode saja. Pesan/detail error DB
 * (mis. `detail` unique-violation yang memuat email) TIDAK pernah ikut. Modul murni (juga
 * dipakai proxy).
 */
export function safeError(e: unknown): string {
  const name = e instanceof Error ? e.name : "unknown";
  const rec = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
  const code = typeof rec.code === "string" ? `:${rec.code}` : "";
  return `${name}${code}`;
}
