import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  loadMoreInputSchema,
  parseCategoryParam,
} from "@/lib/validation/campaign-list";

const SLUGS = ["pendidikan", "masjid", "yatim-dhuafa"];

describe("parseCategoryParam", () => {
  it.each([
    ["pendidikan", "pendidikan"],
    ["  Masjid ", "masjid"],
    [["yatim-dhuafa", "masjid"], "yatim-dhuafa"],
  ])("menerima slug valid %j", (raw, expected) => {
    expect(parseCategoryParam(raw, SLUGS)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "tidak-ada",
    "../admin",
    "masjid' or 1=1--",
    "a".repeat(100),
    [],
  ])("mengabaikan nilai tidak valid %j", (raw) => {
    expect(parseCategoryParam(raw as string | string[] | undefined, SLUGS)).toBeUndefined();
  });
});

describe("keyset cursor", () => {
  const cursor = {
    publishedAt: new Date("2026-11-01T03:04:05.678Z"),
    id: "0195f2a0-1c2d-7e3f-8a9b-0c1d2e3f4a5b",
  };

  it("round-trip encode/decode", () => {
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it.each([
    undefined,
    123,
    "",
    "bukan base64!",
    Buffer.from("2026-11-01T03:04:05.678Z").toString("base64url"),
    Buffer.from("tanggal|0195f2a0-1c2d-7e3f-8a9b-0c1d2e3f4a5b").toString("base64url"),
    Buffer.from("2026-11-01T03:04:05.678Z|bukan-uuid").toString("base64url"),
    Buffer.from("2026-11-01T03:04:05.678Z|0195f2a0-1c2d-7e3f-8a9b-0c1d2e3f4a5b|x").toString("base64url"),
    Buffer.from("2026-11-01|0195f2a0-1c2d-7e3f-8a9b-0c1d2e3f4a5b").toString("base64url"),
  ])("menolak cursor rusak %j", (raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });
});

describe("loadMoreInputSchema", () => {
  it("default status published", () => {
    const r = loadMoreInputSchema.parse({ cursor: "abc" });
    expect(r.status).toBe("published");
  });

  it("menolak status non-publik", () => {
    expect(loadMoreInputSchema.safeParse({ cursor: "abc", status: "draft" }).success).toBe(false);
  });
});
