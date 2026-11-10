/**
 * Terbilang Bahasa Indonesia untuk nominal rupiah (P19, kuitansi). Bekerja penuh di bigint —
 * tidak pernah dikonversi ke `number`, sehingga nilai di atas 2^53 tetap tepat.
 * Contoh: 1_250_000n → "satu juta dua ratus lima puluh ribu".
 */
const DIGITS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
/** Skala per 3 digit (10^3 … 10^33). */
const SCALES = ["", "ribu", "juta", "miliar", "triliun", "kuadriliun", "kuintiliun", "sekstiliun", "septiliun", "oktiliun", "noniliun", "desiliun"];

function underThousand(n: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 1) words.push("seratus");
  else if (hundreds > 1) words.push(`${DIGITS[hundreds]} ratus`);
  if (rest === 10) words.push("sepuluh");
  else if (rest === 11) words.push("sebelas");
  else if (rest > 11 && rest < 20) words.push(`${DIGITS[rest - 10]} belas`);
  else if (rest >= 20) {
    words.push(`${DIGITS[Math.floor(rest / 10)]} puluh`);
    if (rest % 10) words.push(DIGITS[rest % 10]!);
  } else if (rest > 0) words.push(DIGITS[rest]!);
  return words.join(" ");
}

export function terbilang(value: bigint): string {
  if (value < 0n) return `minus ${terbilang(-value)}`;
  if (value === 0n) return "nol";
  const groups: number[] = [];
  for (let v = value; v > 0n; v /= 1000n) groups.push(Number(v % 1000n)); // < 1000: aman sebagai number
  if (groups.length > SCALES.length) throw new RangeError("Nominal terlalu besar untuk terbilang");
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (g === 0) continue;
    if (i === 1 && g === 1) words.push("seribu");
    else words.push(i === 0 ? underThousand(g) : `${underThousand(g)} ${SCALES[i]}`);
  }
  return words.join(" ");
}

/** "Satu juta rupiah" — huruf awal kapital, akhiran "rupiah". */
export function terbilangRupiah(value: bigint): string {
  const text = `${terbilang(value)} rupiah`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
