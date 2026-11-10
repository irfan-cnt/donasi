import { describe, expect, it } from "vitest";
import { terbilang, terbilangRupiah } from "@/lib/format/terbilang";

describe("terbilang (P19)", () => {
  it.each([
    [0n, "nol"],
    [1n, "satu"],
    [9n, "sembilan"],
    [10n, "sepuluh"],
    [11n, "sebelas"],
    [12n, "dua belas"],
    [15n, "lima belas"],
    [19n, "sembilan belas"],
    [20n, "dua puluh"],
    [21n, "dua puluh satu"],
    [99n, "sembilan puluh sembilan"],
    [100n, "seratus"],
    [101n, "seratus satu"],
    [110n, "seratus sepuluh"],
    [111n, "seratus sebelas"],
    [115n, "seratus lima belas"],
    [200n, "dua ratus"],
    [999n, "sembilan ratus sembilan puluh sembilan"],
    [1_000n, "seribu"],
    [1_001n, "seribu satu"],
    [1_100n, "seribu seratus"],
    [1_111n, "seribu seratus sebelas"],
    [2_000n, "dua ribu"],
    [11_000n, "sebelas ribu"],
    [12_500n, "dua belas ribu lima ratus"],
    [100_000n, "seratus ribu"],
    [101_000n, "seratus satu ribu"],
    [111_111n, "seratus sebelas ribu seratus sebelas"],
    [999_999n, "sembilan ratus sembilan puluh sembilan ribu sembilan ratus sembilan puluh sembilan"],
    [1_000_000n, "satu juta"],
    [1_001_000n, "satu juta seribu"],
    [1_250_000n, "satu juta dua ratus lima puluh ribu"],
    [10_000_000n, "sepuluh juta"],
    [100_000_000n, "seratus juta"],
    [999_999_999n, "sembilan ratus sembilan puluh sembilan juta sembilan ratus sembilan puluh sembilan ribu sembilan ratus sembilan puluh sembilan"],
    [1_000_000_000n, "satu miliar"],
    [1_000_001_000n, "satu miliar seribu"],
    [1_000_000_000_000n, "satu triliun"],
  ])("%s → %s", (n, words) => {
    expect(terbilang(n)).toBe(words);
  });

  it("bigint di atas 2^53 tetap tepat (tanpa konversi Number)", () => {
    // 2^53 + 1 = 9.007.199.254.740.993 — Number(...) akan membulatkan ke ...992.
    expect(terbilang(9_007_199_254_740_993n)).toBe(
      "sembilan kuadriliun tujuh triliun seratus sembilan puluh sembilan miliar dua ratus lima puluh empat juta tujuh ratus empat puluh ribu sembilan ratus sembilan puluh tiga",
    );
  });

  it("tidak ada spasi ganda/akhiran kosong pada kelompok nol", () => {
    for (const n of [1_000_000n, 1_000_001n, 20_000_100n, 1_000_000_000n]) {
      expect(terbilang(n)).not.toMatch(/\s{2,}|^\s|\s$/);
    }
  });

  it("terbilangRupiah: kapital + 'rupiah'", () => {
    expect(terbilangRupiah(50_000n)).toBe("Lima puluh ribu rupiah");
    expect(terbilangRupiah(1_000_000_000n)).toBe("Satu miliar rupiah");
  });
});
