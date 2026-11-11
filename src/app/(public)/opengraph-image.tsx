import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// OG image dinamis landing page (P30, S2 SEO). Hanya headline + logo — tanpa angka statistik
// (hindari angka nol tersimpan di cache). Aset lokal saja (logo dari /public, font bawaan next/og): tanpa fetch
// eksternal.
export const alt = `${SITE_NAME} — Kebaikan kecil, dampak yang nyata.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/icon-512.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#053F1E",
        color: "#FFFFFF",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <img
          src={logoSrc}
          width={96}
          height={96}
          alt=""
          style={{ borderRadius: 24, background: "#FFFFFF" }}
        />
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{SITE_NAME}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          Kebaikan kecil, dampak yang nyata.
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#FEF3DC" }}>
          Tanpa wajib daftar · Kuitansi otomatis
        </div>
      </div>
      <div
        style={{ display: "flex", height: 10, width: 220, background: "#F89808", borderRadius: 5 }}
      />
    </div>,
    size,
  );
}
