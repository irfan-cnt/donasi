import "server-only";

// Redaksi payload sebelum disimpan ke payment_events / log. Header tidak pernah disimpan;
// fungsi ini menjaga body: kunci rahasia dihapus, PII disamarkan, server key literal diganti.

const SECRET_KEYS = /(authorization|server_key|serverkey|signature_key|password|token|secret)/i;

function maskEmail(v: string): string {
  const [user, domain] = v.split("@");
  if (!domain) return "***";
  return `${(user ?? "").slice(0, 1)}***@${domain}`;
}

function maskPhone(v: string): string {
  return v.length <= 4 ? "***" : `***${v.slice(-4)}`;
}

function maskName(v: string): string {
  return v ? `${v.slice(0, 1)}***` : v;
}

export function redactPayload(value: unknown, serverKey?: string): unknown {
  const walk = (v: unknown, key?: string): unknown => {
    if (key && SECRET_KEYS.test(key)) return "[REDACTED]";
    if (typeof v === "string") {
      const k = key?.toLowerCase();
      if (k === "email") return maskEmail(v);
      if (k === "phone") return maskPhone(v);
      if (k === "first_name" || k === "last_name") return maskName(v);
      return serverKey && v.includes(serverKey) ? v.split(serverKey).join("[REDACTED]") : v;
    }
    if (typeof v === "bigint") return v.toString();
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k);
      return out;
    }
    return v;
  };
  return walk(value);
}
