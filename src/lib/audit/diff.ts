// Diff sederhana untuk audit log: hanya field yang berubah (dangkal, per kunci teratas).
type Json = Record<string, unknown>;

const REDACTED_KEYS = /password|secret|token|hash/i;

/** Ganti nilai field sensitif dengan "[redacted]" — audit tidak boleh menyimpan secret. */
export function redact(obj: Json | null | undefined): Json | null {
  if (!obj) return null;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, REDACTED_KEYS.test(k) ? "[redacted]" : v]),
  );
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diff(
  before: Json | null | undefined,
  after: Json | null | undefined,
): { before: Json | null; after: Json | null } {
  if (!before || !after) return { before: redact(before), after: redact(after) };
  const b: Json = {};
  const a: Json = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!same(before[key], after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: redact(b), after: redact(a) };
}
