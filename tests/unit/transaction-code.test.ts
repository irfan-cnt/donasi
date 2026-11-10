import { describe, expect, it } from "vitest";
import {
  generateTransactionCode,
  isTransactionCode,
  jakartaDateStamp,
} from "@/lib/transaction-code";

describe("transaction code", () => {
  it("matches TK-YYMMDD-XXXXXX with Crockford base32", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateTransactionCode(new Date("2026-03-05T10:00:00Z"));
      expect(isTransactionCode(code)).toBe(true);
      expect(code.startsWith("TK-260305-")).toBe(true);
      expect(code.slice(10)).not.toMatch(/[ILOU]/);
    }
  });

  it("uses Asia/Jakarta date (UTC+7)", () => {
    // 2026-03-05 17:30 UTC = 2026-03-06 00:30 WIB
    expect(jakartaDateStamp(new Date("2026-03-05T17:30:00Z"))).toBe("260306");
    expect(jakartaDateStamp(new Date("2026-03-05T16:59:59Z"))).toBe("260305");
  });

  it("rejects malformed codes", () => {
    expect(isTransactionCode("TK-260305-ABCDEI")).toBe(false);
    expect(isTransactionCode("TK-26035-ABCDEF")).toBe(false);
  });
});
