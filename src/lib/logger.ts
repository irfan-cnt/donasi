import { randomUUID } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACT_KEYS = /(secret|password|token|authorization|cookie|key)/i;

// Access token transaksi (?t=), token pratinjau (?token=) dll. di URL/query string — juga bentuk
// ter-encode (%3Ft%3D… / %26t%3D…, mis. di callbackUrl). security.md §2: tidak pernah masuk log.
const URL_TOKEN = /((?:[?&]|%3F|%26)(?:t|token|access_token|code_verifier)(?:=|%3D))[^&#\s"'%]+/gi;

/** Samarkan nilai parameter token di URL/teks apa pun. */
export function redactUrlTokens(text: string): string {
  return text.replace(URL_TOKEN, "$1[REDACTED]");
}

function redactValue(v: unknown, depth: number): unknown {
  if (typeof v === "string") return redactUrlTokens(v);
  if (typeof v === "bigint") return v.toString();
  if (v instanceof URL) return redactUrlTokens(v.toString());
  if (depth < 3 && Array.isArray(v)) return v.map((x) => redactValue(x, depth + 1));
  if (depth < 3 && v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return redact(v as Fields, depth + 1);
  }
  return v;
}

export function redact(fields: Fields, depth = 0): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = REDACT_KEYS.test(k) ? "[REDACTED]" : redactValue(v, depth);
  }
  return out;
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

/** Logger JSON satu baris per event; field sensitif disamarkan. */
export function createLogger(base: Fields = {}): Logger {
  const write = (level: Level, msg: string, fields: Fields = {}) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: redactUrlTokens(msg),
      ...redact({ ...base, ...fields }),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
    child: (f) => createLogger({ ...base, ...f }),
  };
}

export const logger = createLogger();

/** Logger per request dengan requestId (dari header x-request-id bila ada). */
export function requestLogger(requestId?: string | null): Logger {
  return logger.child({ requestId: requestId || randomUUID() });
}
