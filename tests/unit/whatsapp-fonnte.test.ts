import { describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env";
import { dedupKey, notifyJobSchema, qstashDedupId } from "@/lib/notifications/jobs";
import {
  createFonnteSender,
  FonnteError,
  mapFonnteReason,
  toFonnteTarget,
} from "@/lib/whatsapp/fonnte";

// HTTP Fonnte selalu dimock (fetch di-inject) — tidak ada panggilan jaringan.
const TOKEN = "unit-token-RAHASIA";
const URL_ = "https://fonnte.mock.test/send";
const sender = (impl: (init: RequestInit) => Response | Promise<Response>, timeoutMs?: number) => {
  const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => impl(init!));
  return { f, s: createFonnteSender({ token: TOKEN, apiUrl: URL_, fetch: f as typeof fetch, timeoutMs }) };
};
const err = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as FonnteError;
  }
  throw new Error("tidak melempar");
};

describe("toFonnteTarget", () => {
  it.each([
    ["+6281234567890", "6281234567890"],
    ["081234567890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["+62 812-3456-7890", "6281234567890"],
  ])("%s → %s", (input, out) => expect(toFonnteTarget(input)).toBe(out));
  it.each([null, "", "+15551234567", "+62212345678", "0812", "abc"])("tidak valid: %s", (v) =>
    expect(toFonnteTarget(v)).toBeNull(),
  );
});

describe("mapFonnteReason (reason verbatim docs.fonnte.com)", () => {
  it.each([
    ["token invalid", "invalid_token"],
    ["disconnected device", "device_disconnected"],
    ["target invalid", "invalid_target"],
    ["insufficient quota", "quota_exceeded"],
    ["input invalid", "invalid_input"],
    ["something else", "unknown"],
  ])("%s → %s", (r, c) => expect(mapFonnteReason(r)).toBe(c));
});

describe("createFonnteSender", () => {
  it("POST form target/message/countryCode=0, header Authorization = token tanpa Bearer", async () => {
    const { f, s } = sender(() =>
      Response.json({ detail: "success! message in queue", id: ["1"], process: "pending", requestid: 7, status: true, target: ["628"] }),
    );
    const res = await s.send({ target: "6281234567890", message: "halo" });
    expect(res).toEqual({ detail: "success! message in queue", id: ["1"], process: "pending", requestid: 7 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(URL_);
    expect(init!.method).toBe("POST");
    expect(new Headers(init!.headers).get("authorization")).toBe(TOKEN);
    const body = init!.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({ target: "6281234567890", message: "halo", countryCode: "0" });
    expect(JSON.stringify(res)).not.toContain(TOKEN);
  });

  it("menerima 'Status' huruf besar (contoh error token di docs)", async () => {
    const { s } = sender(() => Response.json({ reason: "token invalid", Status: false }));
    const e = await err(s.send({ target: "628", message: "x" }));
    expect(e).toBeInstanceOf(FonnteError);
    expect(e.code).toBe("invalid_token");
    expect(e.retryable).toBe(false);
    expect(JSON.stringify(e.response) + e.message).not.toContain(TOKEN);
  });

  it("HTTP 5xx tanpa JSON → http_error (retryable)", async () => {
    const { s } = sender(() => new Response("oops", { status: 503 }));
    const e = await err(s.send({ target: "628", message: "x" }));
    expect(e.code).toBe("http_error");
    expect(e.retryable).toBe(true);
  });

  it("jaringan gagal → network; timeout → timeout (keduanya retryable)", async () => {
    const net = sender(() => {
      throw new TypeError("fetch failed");
    });
    expect((await err(net.s.send({ target: "628", message: "x" }))).code).toBe("network");
    const slow = sender(
      (init) =>
        new Promise<Response>((_, reject) =>
          init.signal!.addEventListener("abort", () => reject(init.signal!.reason)),
        ),
      20,
    );
    const e = await err(slow.s.send({ target: "628", message: "x" }));
    expect(e.code).toBe("timeout");
    expect(e.retryable).toBe(true);
  });

  it("menolak FONNTE_API_URL non-https", () => {
    expect(() => createFonnteSender({ token: TOKEN, apiUrl: "http://api.fonnte.com/send" })).toThrow(/https/);
  });
});

describe("env P17", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@h/db",
    DATABASE_URL_UNPOOLED: "postgres://u:p@h/db",
    AUTH_SECRET: "x".repeat(32),
  };
  it("default FONNTE_API_URL & FONNTE_MIN_DELAY_MS", () => {
    const env = parseServerEnv(base);
    expect(env.FONNTE_API_URL).toBe("https://api.fonnte.com/send");
    expect(env.FONNTE_MIN_DELAY_MS).toBe(3000);
  });
  it("FONNTE_TOKEN wajib hanya bila WHATSAPP_ENABLED=true; pesan tanpa nilai", () => {
    expect(() => parseServerEnv({ ...base, WHATSAPP_ENABLED: "true" })).toThrow(/FONNTE_TOKEN/);
    expect(() => parseServerEnv({ ...base, WHATSAPP_ENABLED: "true", FONNTE_TOKEN: "t" })).not.toThrow();
    expect(() => parseServerEnv({ ...base, WHATSAPP_ENABLED: "false" })).not.toThrow();
  });
  it("FONNTE_API_URL harus https; FONNTE_MIN_DELAY_MS ≥ 1000", () => {
    expect(() => parseServerEnv({ ...base, FONNTE_API_URL: "http://api.fonnte.com/send" })).toThrow(/FONNTE_API_URL/);
    expect(() => parseServerEnv({ ...base, FONNTE_MIN_DELAY_MS: "100" })).toThrow(/FONNTE_MIN_DELAY_MS/);
  });
});

describe("job whatsapp.send", () => {
  const trx = "0190f0b2-0000-7000-8000-000000000001";
  const pay = "0190f0b2-0000-7000-8000-000000000002";
  it("dedup_key sama dengan baris WA event asal (kontrak drain outbox §6a)", () => {
    const job = { event: "whatsapp.send", source: "payment.paid", transactionId: trx, paymentId: pay } as const;
    expect(notifyJobSchema.safeParse(job).success).toBe(true);
    expect(dedupKey(job, "whatsapp")).toBe(`payment.paid:${trx}:whatsapp`);
    const pending = { ...job, source: "payment.pending" } as const;
    expect(dedupKey(pending, "whatsapp")).toBe(`payment.pending:${trx}:${pay}:whatsapp`);
    expect(qstashDedupId(pending)).not.toBe(qstashDedupId({ ...pending, source: "payment.failed" }));
  });
  it("source di luar template WA ditolak", () => {
    expect(notifyJobSchema.safeParse({ event: "whatsapp.send", source: "payment.expired", transactionId: trx, paymentId: pay }).success).toBe(false);
  });
});
