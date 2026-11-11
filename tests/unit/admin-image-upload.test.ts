import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// H2/L1: route upload — content-length wajib, batas ditegakkan pada stream, rate limit, origin.
const rate = vi.fn(async () => ({ success: true, remaining: 29, reset: 0 }));
vi.mock("@/lib/redis", () => ({ rateLimit: () => rate() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-auth", () => ({
  // P25 (I4): route memakai requireAdminApi (401/403 JSON).
  requireAdminApi: vi.fn(async () => ({ ok: true, ctx: { adminId: "019a0000-0000-7000-8000-000000000001", permissions: ["campaigns.write"] } })),
  getRequestMeta: vi.fn(async () => ({ ip: null, ua: null })),
}));

import { POST } from "@/app/api/admin/images/route";
import { requireAdminApi } from "@/lib/admin-auth";
import { BodyTooLargeError, readCapped } from "@/lib/http/read-capped";
import { blobStoreHost } from "@/lib/storage/blob-host";
import { setImageStorageForTests } from "@/lib/storage/image-storage";

const ORIGIN = "https://tebar.example";

function req(body: BodyInit | ReadableStream<Uint8Array>, headers: Record<string, string>) {
  return new Request(`${ORIGIN}/api/admin/images`, {
    method: "POST",
    body,
    headers: { origin: ORIGIN, ...headers },
    // @ts-expect-error duplex wajib untuk body stream di Node
    duplex: "half",
  });
}

async function multipart(buf: Buffer) {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(buf)], "a.png", { type: "image/png" }));
  const r = new Request("http://x", { method: "POST", body: fd });
  const data = Buffer.from(await r.arrayBuffer());
  return { data, type: r.headers.get("content-type")! };
}

describe("POST /api/admin/images", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", ORIGIN);
    rate.mockClear();
    setImageStorageForTests({ kind: "memory", put: async (k) => ({ url: `/api/dev-uploads/${k.replace(/\//g, "-")}` }) });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setImageStorageForTests(null);
  });

  it("tanpa / non-numerik content-length → 411", async () => {
    const { data, type } = await multipart(Buffer.from("x"));
    const stream = new Response(new Uint8Array(data)).body!;
    expect((await POST(req(stream, { "content-type": type }))).status).toBe(411);
    expect((await POST(req(new Uint8Array(data), { "content-type": type, "content-length": "abc" }))).status).toBe(411);
  });

  it("content-length berbohong (kecil) tetapi stream > batas → 413 sebelum parsing", async () => {
    const big = new Uint8Array(3 * 1024 * 1024);
    const stream = new Response(big).body!;
    const res = await POST(req(stream, { "content-type": "multipart/form-data; boundary=x", "content-length": "100" }));
    expect(res.status).toBe(413);
  });

  it("origin lain ditolak (L1), rate limit → 429 (H2)", async () => {
    const { data, type } = await multipart(Buffer.from("x"));
    const h = { "content-type": type, "content-length": String(data.length) };
    expect((await POST(new Request(`${ORIGIN}/api/admin/images`, { method: "POST", body: new Uint8Array(data), headers: { ...h, origin: "https://evil.example", host: "evil.example" } }))).status).toBe(403);
    rate.mockResolvedValueOnce({ success: false, remaining: 0, reset: 0 });
    expect((await POST(req(new Uint8Array(data), h))).status).toBe(429);
  });

  it("P25 I4: tanpa sesi/izin → 401/403 JSON (bukan redirect), sebelum membaca body", async () => {
    vi.mocked(requireAdminApi).mockResolvedValueOnce({ ok: false, response: Response.json({ error: "x" }, { status: 401 }) });
    expect((await POST(req("x", { "content-length": "1" }))).status).toBe(401);
    vi.mocked(requireAdminApi).mockResolvedValueOnce({ ok: false, response: Response.json({ error: "x" }, { status: 403 }) });
    expect((await POST(req("x", { "content-length": "1" }))).status).toBe(403);
    expect(vi.mocked(requireAdminApi)).toHaveBeenCalledWith(["campaigns.write", "news.write", "payment_methods.write"]);
    expect(rate).not.toHaveBeenCalled();
  });

  it("PNG valid → 201 WebP", async () => {
    const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#fff" } }).png().toBuffer();
    const { data, type } = await multipart(png);
    const res = await POST(req(new Uint8Array(data), { "content-type": type, "content-length": String(data.length) }));
    expect(res.status).toBe(201);
    expect((await res.json()).url).toMatch(/\.webp$/);
  });
});

describe("readCapped & blobStoreHost", () => {
  it("membatalkan stream di atas batas", async () => {
    await expect(readCapped(new Response(new Uint8Array(11)).body, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect((await readCapped(new Response(new Uint8Array(10)).body, 10)).length).toBe(10);
  });
  it("host dari BLOB_STORE_ID atau token; input tak valid → null", () => {
    expect(blobStoreHost({ BLOB_STORE_ID: "store_AbCdEf123456" })).toBe("abcdef123456.public.blob.vercel-storage.com");
    expect(blobStoreHost({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbCdEf123456_secret" })).toBe("abcdef123456.public.blob.vercel-storage.com");
    expect(blobStoreHost({ BLOB_STORE_ID: "evil.com/x" })).toBeNull();
    expect(blobStoreHost({})).toBeNull();
  });
});
