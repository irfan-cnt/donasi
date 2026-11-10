import { describe, expect, it } from "vitest";
import { formatDateJakarta, formatRelativePast } from "@/lib/format/relative-time";
import { serializeJsonLd } from "@/lib/json-ld";
import { sanitizeRichText } from "@/lib/sanitize";
import {
  PREVIEW_TTL_SECONDS,
  signPreviewToken,
  verifyPreviewToken,
} from "@/lib/security/preview-token-core";
import { normalizeSlug } from "@/lib/slug";

const at = (iso: string) => new Date(iso);

describe("formatRelativePast (Asia/Jakarta)", () => {
  const now = at("2026-11-10T10:00:00+07:00");

  it("baru saja / menit / jam", () => {
    expect(formatRelativePast(at("2026-11-10T09:59:30+07:00"), now)).toBe("baru saja");
    expect(formatRelativePast(at("2026-11-10T09:55:00+07:00"), now)).toBe("5 menit lalu");
    expect(formatRelativePast(at("2026-11-10T07:00:00+07:00"), now)).toBe("3 jam lalu");
  });

  it("kemarin mengikuti tanggal kalender Jakarta, bukan selisih 24 jam", () => {
    // 23:30 WIB kemarin: baru 10,5 jam lalu tetapi sudah beda tanggal di Jakarta.
    expect(formatRelativePast(at("2026-11-09T23:30:00+07:00"), now)).toBe("kemarin");
    // 00:30 WIB hari ini = 17:30Z kemarin di UTC → tetap "jam lalu" di Jakarta.
    expect(formatRelativePast(at("2026-11-10T00:30:00+07:00"), now)).toBe("9 jam lalu");
  });

  it("hari lalu lalu tanggal absolut", () => {
    expect(formatRelativePast(at("2026-11-07T12:00:00+07:00"), now)).toBe("3 hari lalu");
    expect(formatRelativePast(at("2026-09-01T12:00:00+07:00"), now)).toBe(
      formatDateJakarta(at("2026-09-01T12:00:00+07:00")),
    );
    expect(formatDateJakarta(at("2026-09-01T12:00:00+07:00"))).toMatch(/1 Sep 2026/);
  });

  it("tidak pernah 'dari sekarang' / 'lagi' untuk waktu masa depan atau lampau", () => {
    for (const offsetMin of [-5, 1, 30, 60 * 5, 60 * 30, 60 * 24 * 40]) {
      const label = formatRelativePast(new Date(now.getTime() - offsetMin * 60_000), now);
      expect(label).not.toMatch(/dari sekarang|lagi/);
    }
    expect(formatRelativePast(at("2026-11-10T10:05:00+07:00"), now)).toBe("baru saja");
  });
});

describe("preview token", () => {
  const secret = "s".repeat(40);
  const id = "0b9f2c1e-6c1a-4b8e-9a51-2f1f0f3a9d10";
  const t0 = Date.UTC(2026, 10, 10, 3, 0, 0);

  it("sign → verify mengembalikan campaignId", () => {
    expect(verifyPreviewToken(signPreviewToken(id, secret, t0), secret, t0)).toBe(id);
  });

  it("berlaku 1 jam lalu kedaluwarsa", () => {
    const token = signPreviewToken(id, secret, t0);
    expect(PREVIEW_TTL_SECONDS).toBe(3600);
    expect(verifyPreviewToken(token, secret, t0 + 3599_000)).toBe(id);
    expect(verifyPreviewToken(token, secret, t0 + 3600_000)).toBeNull();
  });

  it("menolak secret lain, tanda tangan/payload diubah, dan format rusak", () => {
    const token = signPreviewToken(id, secret, t0);
    expect(verifyPreviewToken(token, "x".repeat(40), t0)).toBeNull();
    const [cid, exp, sig] = token.split(".");
    expect(verifyPreviewToken(`${cid}.${Number(exp) + 3600}.${sig}`, secret, t0)).toBeNull();
    const other = "1b9f2c1e-6c1a-4b8e-9a51-2f1f0f3a9d10";
    expect(verifyPreviewToken(`${other}.${exp}.${sig}`, secret, t0)).toBeNull();
    expect(verifyPreviewToken(`${cid}.${exp}.${sig}A`, secret, t0)).toBeNull();
    for (const bad of ["", "a.b", "a.b.c.d", `${cid}.abc.${sig}`, "x".repeat(300)]) {
      expect(verifyPreviewToken(bad, secret, t0)).toBeNull();
    }
  });
});

describe("normalizeSlug", () => {
  it("huruf kecil & trim", () => {
    expect(normalizeSlug("Contoh-Beasiswa")).toBe("contoh-beasiswa");
    expect(normalizeSlug("%20abc-1%20")).toBe("abc-1");
    expect(normalizeSlug("abc")).toBe("abc");
  });
  it("menolak slug tidak valid", () => {
    for (const bad of ["", "a--b", "-a", "a_b", "a/b", "%E0%A4%A", "ab c", "a".repeat(201)]) {
      expect(normalizeSlug(bad)).toBeNull();
    }
  });
});

describe("serializeJsonLd", () => {
  it("meng-escape </script> dan karakter berbahaya", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script> & \u2028" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script> & \u2028" });
  });
});

describe("sanitizeRichText", () => {
  it("membuang script, event handler, javascript: URL, dan gambar", () => {
    const out = sanitizeRichText(
      '<p onclick="x()">Halo<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><a href="https://contoh.id">ok</a>',
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(out).toContain("<p>Halo</p>");
    expect(out).toContain('href="https://contoh.id"');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
  });
  it("menurunkan h1 menjadi h2", () => {
    expect(sanitizeRichText("<h1>Judul</h1>")).toBe("<h2>Judul</h2>");
  });
});
