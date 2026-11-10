import { describe, expect, it } from "vitest";
import { formatRupiah, progressPercent, sumRupiah, toRupiah } from "@/lib/money";

describe("money", () => {
  it("formats rupiah in id-ID", () => {
    expect(formatRupiah(1_250_000n)).toBe("Rp 1.250.000");
    expect(formatRupiah(0n)).toBe("Rp 0");
  });

  it("formats beyond Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(formatRupiah(9_007_199_254_740_993n)).toBe("Rp 9.007.199.254.740.993");
  });

  it("converts safely to bigint", () => {
    expect(toRupiah("50000")).toBe(50_000n);
    expect(toRupiah(10_000)).toBe(10_000n);
    expect(() => toRupiah(10.5)).toThrow(RangeError);
    expect(() => toRupiah("1e3")).toThrow(RangeError);
    expect(() => toRupiah("abc")).toThrow(RangeError);
  });

  it("sums and computes progress", () => {
    expect(sumRupiah([1n, 2n, 3n])).toBe(6n);
    expect(progressPercent(250n, 1000n)).toBe(25);
    expect(progressPercent(2000n, 1000n)).toBe(100);
    expect(progressPercent(5n, 0n)).toBe(0);
  });
});
