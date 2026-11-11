import type { Metadata } from "next";
import { forbidden } from "next/navigation";

// P25 (L2): target rewrite proxy untuk halaman admin tanpa permission. forbidden() di level atas
// (di luar Suspense) → Next merender src/app/forbidden.tsx dengan HTTP 403 sungguhan.
// Selalu 403 → validasi instant dev tidak bisa merender segmen ini; opt-out (instant.md).
export const instant = false;

export const metadata: Metadata = { title: "Akses ditolak", robots: { index: false, follow: false } };

export default function AksesDitolak(): never {
  forbidden();
}
