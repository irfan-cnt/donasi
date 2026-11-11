import { beforeEach, describe, expect, it, vi } from "vitest";

// P24: cache Redis (hit/miss/fallback/invalidasi) dan throttle revalidateTag. Redis & Next
// dimock; tidak ada koneksi jaringan.

const store = new Map<string, unknown>();
const redis = {
  get: vi.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
  set: vi.fn(async (k: string, v: unknown, opts?: { nx?: boolean }) => {
    if (opts?.nx && store.has(k)) return null;
    store.set(k, v);
    return "OK";
  }),
  del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
};
const env = { APP_ENV: "production", UPSTASH_REDIS_REST_URL: "https://redis.example" };
const revalidateTag = vi.fn();
const dbRows: { slug: string }[] = [{ slug: "masjid" }];

vi.mock("@/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/cache", () => ({ revalidateTag, cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/qstash", () => ({ publishJob: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => dbRows }) }) }),
  }),
}));

const { cachedJson, invalidateCache } = await import("@/lib/redis/cache");
const { featuredCodec, FEATURED_CACHE_KEY, CAMPAIGNS_TAG } = await import(
  "@/server/queries/public-campaigns"
);
const { revalidateCampaignThrottled } = await import("@/lib/payments/webhook/side-effects");

const identity = { serialize: (v: unknown) => v, deserialize: (r: unknown) => r };
const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  env.APP_ENV = "production";
  env.UPSTASH_REDIS_REST_URL = "https://redis.example";
});

describe("cachedJson", () => {
  it("miss → loader + set dengan TTL, hit berikutnya tanpa loader", async () => {
    const loader = vi.fn(async () => ({ n: 1 }));
    expect(await cachedJson("k", 60, loader, identity)).toEqual({ n: 1 });
    expect(redis.set).toHaveBeenCalledWith("tk:cache:k", { n: 1 }, { ex: 60 });
    expect(await cachedJson("k", 60, loader, identity)).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("Redis error saat get/set → fallback ke loader (DB), tidak melempar", async () => {
    redis.get.mockRejectedValueOnce(new Error("down"));
    redis.set.mockRejectedValueOnce(new Error("down"));
    const loader = vi.fn(async () => "db");
    expect(await cachedJson("k", 60, loader, identity)).toBe("db");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("development tanpa Upstash → Redis dilewati", async () => {
    env.APP_ENV = "development";
    env.UPSTASH_REDIS_REST_URL = "";
    expect(await cachedJson("k", 60, async () => 7, identity)).toBe(7);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("invalidateCache menghapus entri → loader dipanggil lagi", async () => {
    const loader = vi.fn(async () => 1);
    await cachedJson("k", 60, loader, identity);
    await invalidateCache("k");
    await cachedJson("k", 60, loader, identity);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("kunci cache kartu pilihan konstan (tidak dari input request)", () => {
    expect(FEATURED_CACHE_KEY).toBe("featured:v1");
  });
});

describe("featuredCodec", () => {
  it("bigint round-trip lewat JSON tanpa kehilangan presisi", () => {
    const card = {
      id: "1",
      slug: "s",
      title: "t",
      imageUrl: "/i.png",
      imageAlt: "a",
      categorySlug: "c",
      categoryName: "C",
      categoryIcon: null,
      targetAmount: 9_007_199_254_740_993n,
      collectedAmount: 12n,
      donorCount: 1,
      status: "published" as const,
      daysLeft: null,
    };
    const raw = JSON.parse(JSON.stringify(featuredCodec.serialize(card)));
    expect(featuredCodec.deserialize(raw)).toEqual(card);
    expect(featuredCodec.deserialize(featuredCodec.serialize(null))).toBeNull();
  });
});

describe("revalidateCampaignThrottled", () => {
  it("revalidate campaign:{slug} + campaigns maks. 1× per jendela, hapus Redis kartu pilihan", async () => {
    store.set(`tk:cache:${FEATURED_CACHE_KEY}`, { stale: true });
    await revalidateCampaignThrottled("id-1", log);
    expect(revalidateTag).toHaveBeenCalledWith("campaign:masjid", "max");
    expect(revalidateTag).toHaveBeenCalledWith(CAMPAIGNS_TAG, "max");
    expect(store.has(`tk:cache:${FEATURED_CACHE_KEY}`)).toBe(false);
    expect(redis.set).toHaveBeenCalledWith("tk:throttle:revalidate:campaign:masjid", "1", {
      nx: true,
      ex: 10,
    });

    revalidateTag.mockClear();
    await revalidateCampaignThrottled("id-1", log); // masih dalam jendela 10 s
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("Redis error → fail-open (tetap revalidate)", async () => {
    redis.set.mockRejectedValue(new Error("down"));
    await revalidateCampaignThrottled("id-1", log);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    redis.set.mockReset();
  });
});
