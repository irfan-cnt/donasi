import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Batching & anggaran waktu job tanpa DB: getDb().execute di-mock.
const execute = vi.fn();
vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute }),
  getTxDb: () => {
    throw new Error("tidak dipakai");
  },
}));

const { runCancelStale } = await import("@/server/services/jobs/cancel-stale");
const { runExpirePayments } = await import("@/server/services/jobs/expire-payments");
const { createLogger } = await import("@/lib/logger");
const { continuationDepth, publishContinuation, MAX_CONTINUATION_DEPTH } =
  await import("@/server/services/jobs/runtime-deps");

const rows = (n: number) => ({
  rows: Array.from({ length: n }, (_, i) => ({ entity_id: `${i}` })),
});

describe("runCancelStale batching", () => {
  beforeEach(() => execute.mockReset());

  it("mengulang batch selama batch penuh, berhenti saat batch tidak penuh", async () => {
    execute
      .mockResolvedValueOnce(rows(3))
      .mockResolvedValueOnce(rows(3))
      .mockResolvedValueOnce(rows(1));
    const r = await runCancelStale({ deadline: Date.now() + 10_000, batchSize: 3 });
    expect(r).toEqual({ cancelled: 7, hasMore: false });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("anggaran waktu habis → hasMore tanpa query", async () => {
    const r = await runCancelStale({ deadline: 0, now: () => 1 });
    expect(r).toEqual({ cancelled: 0, hasMore: true });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("runExpirePayments batching", () => {
  const dialect = new PgDialect();
  /** Antrian hasil untuk SELECT kandidat; SELECT now()/UPDATE touch/heal dijawab otomatis. */
  let batches: { rows: unknown[] }[] = [];
  const queries: string[] = [];
  beforeEach(() => {
    execute.mockReset();
    batches = [];
    queries.length = 0;
    execute.mockImplementation(async (q: SQL) => {
      const text = dialect.sqlToQuery(q).sql;
      queries.push(text);
      if (text.includes("SELECT now()::text")) return { rows: [{ ts: "2026-11-10 00:00:00+00" }] };
      if (text.includes("ORDER BY p.last_checked_at NULLS FIRST"))
        return batches.shift() ?? { rows: [] };
      return { rows: [] };
    });
  });
  const deps = () => ({
    log: createLogger({ test: "batching" }),
    getProvider: () => null, // provider tak terkonfigurasi → dihitung error, tanpa DB tx
    publishPaid: vi.fn(),
    revalidateCampaign: vi.fn(),
    publishAdminAlert: vi.fn(),
    revalidateTags: vi.fn(),
  });
  const cand = (i: number) => ({
    id: `00000000-0000-7000-8000-00000000000${i}`,
    provider_ref: null,
    code: "midtrans",
  });
  const touches = () => queries.filter((q) => q.includes("SET last_checked_at = now()")).length;

  it("batch penuh → batch berikutnya; last_checked_at disentuh tiap percobaan; heal di akhir", async () => {
    batches = [{ rows: [cand(1), cand(2)] }, { rows: [cand(3)] }];
    const r = await runExpirePayments(deps(), { deadline: Date.now() + 10_000, batchSize: 2 });
    expect(r).toMatchObject({ checked: 3, batches: 2, errors: 3, hasMore: false });
    expect(touches()).toBe(3);
    expect(queries.some((q) => q.includes("transaction.status_healed"))).toBe(true);
  });

  it("deadline lewat di tengah batch → berhenti, hasMore = true, heal dilewati", async () => {
    batches = [{ rows: [cand(1), cand(2)] }];
    let t = 0;
    const d = { ...deps(), now: () => (t += 1) };
    const r = await runExpirePayments(d, { deadline: 4, batchSize: 2 });
    expect(r).toMatchObject({ checked: 1, hasMore: true, healedTransactions: 0 });
    expect(queries.some((q) => q.includes("transaction.status_healed"))).toBe(false);
  });
});

describe("continuation depth (M2)", () => {
  it("body lanjutan divalidasi Zod; selain itu depth 0", () => {
    expect(continuationDepth({ continuation: true, depth: 3 })).toBe(3);
    expect(continuationDepth(null)).toBe(0);
    expect(continuationDepth({ continuation: true, depth: 99 })).toBe(0);
    expect(continuationDepth({ continuation: true, depth: "2" })).toBe(0);
  });

  it("depth maksimum → tidak publish lagi", async () => {
    const log = createLogger({ test: "cont" });
    expect(await publishContinuation("/api/jobs/x", MAX_CONTINUATION_DEPTH, log)).toBe(false);
  });
});
