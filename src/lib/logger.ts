import { randomUUID } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACT_KEYS = /(secret|password|token|authorization|cookie|key)/i;

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = REDACT_KEYS.test(k) ? "[REDACTED]" : typeof v === "bigint" ? v.toString() : v;
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
      msg,
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
