import { describe, expect, it } from "vitest";
import { isUuidV7, newId } from "@/lib/id";

describe("UUIDv7", () => {
  it("generates valid, unique, time-ordered v7 ids", () => {
    const ids = Array.from({ length: 100 }, () => newId());
    ids.forEach((id) => expect(isUuidV7(id)).toBe(true));
    expect(new Set(ids).size).toBe(100);
    expect([...ids].sort()).toEqual(ids);
  });

  it("rejects non-v7 uuids", () => {
    expect(isUuidV7("6ba7b810-9dad-41d1-80b4-00c04fd430c8")).toBe(false);
  });
});
