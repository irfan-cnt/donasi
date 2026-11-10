import { createHash, createHmac, randomUUID } from "node:crypto";
import { Receiver } from "@upstash/qstash";
import { describe, expect, it, vi } from "vitest";
import { createJobHandler, type JobLock, type SignatureVerifier } from "@/lib/jobs/job-route";

const URL_PATH = "/api/jobs/test-job";
const SITE = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

function memLock(): JobLock & { held: Set<string> } {
  const held = new Set<string>();
  return {
    held,
    acquire: async (name) => (held.has(name) ? null : (held.add(name), "owner")),
    release: async (name) => void held.delete(name),
  };
}

const req = (body = "{}", headers: Record<string, string> = {}) =>
  new Request(`http://internal${URL_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** JWT QStash (HS256) seperti yang dibuat Upstash — untuk menguji Receiver asli. */
function signQStash(key: string, url: string, body: string, expOffset = 300): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: "Upstash",
      sub: url,
      exp: now + expOffset,
      nbf: now - 10,
      iat: now,
      jti: randomUUID(),
      body: b64url(createHash("sha256").update(body).digest()),
    }),
  );
  const sig = b64url(createHmac("sha256", key).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

describe("createJobHandler — signature QStash", () => {
  const okVerify: SignatureVerifier = async (sig) => sig === "valid";

  it("tanpa header Upstash-Signature → 401 dan job tidak dijalankan", async () => {
    const run = vi.fn(async () => ({}));
    const verify = vi.fn(okVerify);
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, run, {
      verify,
      lock: memLock(),
    });
    const res = await h(req());
    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("signature salah → 401", async () => {
    const run = vi.fn(async () => ({}));
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, run, {
      verify: okVerify,
      lock: memLock(),
    });
    const res = await h(req("{}", { "upstash-signature": "forged" }));
    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("verifier melempar (mis. signing key belum diisi) → 401 fail-closed", async () => {
    const run = vi.fn(async () => ({}));
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, run, {
      verify: async () => {
        throw new Error("Env QSTASH_CURRENT_SIGNING_KEY belum diisi");
      },
      lock: memLock(),
    });
    expect((await h(req("{}", { "upstash-signature": "x" }))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("verifier default (env tanpa signing key) menolak — tidak ada bypass env", async () => {
    const run = vi.fn(async () => ({}));
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, run, { lock: memLock() });
    const res = await h(req("{}", { "upstash-signature": "anything" }));
    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("verifier memakai URL kanonik APP_URL + path dan body mentah", async () => {
    const verify = vi.fn(okVerify);
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, async () => ({}), {
      verify,
      lock: memLock(),
    });
    await h(req('{"a":1}', { "upstash-signature": "valid" }));
    expect(verify).toHaveBeenCalledWith("valid", '{"a":1}', `${SITE}${URL_PATH}`);
  });

  it("Receiver asli: JWT valid diterima; body/URL/kunci beda atau kedaluwarsa ditolak", async () => {
    const receiver = new Receiver({ currentSigningKey: "cur-key", nextSigningKey: "next-key" });
    const verify: SignatureVerifier = async (signature, body, url) => {
      try {
        return await receiver.verify({ signature: signature ?? "", body, url });
      } catch {
        return false;
      }
    };
    const run = vi.fn(async () => ({ n: 1 }));
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, run, {
      verify,
      lock: memLock(),
    });
    const url = `${SITE}${URL_PATH}`;
    expect(
      (await h(req("{}", { "upstash-signature": signQStash("cur-key", url, "{}") }))).status,
    ).toBe(200);
    expect(
      (await h(req("{}", { "upstash-signature": signQStash("next-key", url, "{}") }))).status,
    ).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
    const cases = [
      signQStash("cur-key", url, '{"other":1}'), // body beda
      signQStash("cur-key", "https://evil.test/api/jobs/test-job", "{}"), // URL beda
      signQStash("wrong-key", url, "{}"),
      signQStash("cur-key", url, "{}", -60), // kedaluwarsa
    ];
    for (const sig of cases) {
      expect((await h(req("{}", { "upstash-signature": sig }))).status).toBe(401);
    }
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("body > 4 KB → 413 sebelum verifikasi", async () => {
    const verify = vi.fn(okVerify);
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, async () => ({}), {
      verify,
      lock: memLock(),
    });
    const res = await h(req("x".repeat(5000), { "upstash-signature": "valid" }));
    expect(res.status).toBe(413);
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("createJobHandler — lock & hasil", () => {
  it("lock dipegang run lain → 200 skipped, job tidak dijalankan", async () => {
    const lock = memLock();
    lock.held.add("job:t");
    const run = vi.fn(async () => ({}));
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, run, {
      verify: async () => true,
      lock,
    });
    const res = await h(req("{}", { "upstash-signature": "s" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "skipped" });
    expect(run).not.toHaveBeenCalled();
  });

  it("sukses → 200 + ringkasan, lock dilepas; deadline = now + budget", async () => {
    const lock = memLock();
    let deadline = 0;
    const h = createJobHandler(
      "t",
      { lockTtlMs: 1000, budgetMs: 5000 },
      async (ctx) => {
        deadline = ctx.deadline;
        expect(lock.held.has("job:t")).toBe(true);
        return { checked: 3 };
      },
      { verify: async () => true, lock, now: () => 1_000 },
    );
    const res = await h(req("{}", { "upstash-signature": "s" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, result: "done", checked: 3 });
    expect(deadline).toBe(6_000);
    expect(lock.held.size).toBe(0);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("job melempar → 500 (QStash retry), lock tetap dilepas, pesan error tidak bocor", async () => {
    const lock = memLock();
    const h = createJobHandler(
      "t",
      { lockTtlMs: 1000, budgetMs: 1000 },
      async () => {
        throw new Error("db down secret-detail");
      },
      { verify: async () => true, lock },
    );
    const res = await h(req("{}", { "upstash-signature": "s" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret-detail");
    expect(lock.held.size).toBe(0);
  });

  it("lock store error → 503", async () => {
    const h = createJobHandler("t", { lockTtlMs: 1000, budgetMs: 1000 }, async () => ({}), {
      verify: async () => true,
      lock: {
        acquire: async () => {
          throw new Error("redis down");
        },
        release: async () => {},
      },
    });
    expect((await h(req("{}", { "upstash-signature": "s" }))).status).toBe(503);
  });
});
