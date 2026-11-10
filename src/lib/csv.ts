// CSV (RFC 4180) untuk ekspor admin (P22). Modul murni.
// Pertahanan CSV/formula injection (OWASP): sel yang diawali = + - @ TAB CR diberi prefix
// apostrof agar spreadsheet tidak mengeksekusinya sebagai rumus. Semua sel dikutip bila perlu.

// Juga menangkap spasi/baris baru di depan (beberapa aplikasi spreadsheet melakukan trim).
const FORMULA_START = /^(\s*[=+\-@]|[\t\r])/;

/** Satu sel CSV aman (null/undefined → kosong; bigint/number/boolean → string). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  // Angka hasil sistem (bigint/number) tidak pernah formula, tetapi negatif "-5" tetap dibiarkan apa adanya.
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Satu baris CSV diakhiri CRLF. */
export function csvRow(cells: readonly unknown[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** BOM UTF-8 agar Excel membaca karakter non-ASCII dengan benar. */
export const CSV_BOM = "﻿";
