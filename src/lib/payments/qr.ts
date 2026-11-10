import "server-only";
import QRCode from "qrcode";

/**
 * QR dirender sendiri dari qr_string provider (payment-architecture.md §3a) — tidak pernah memuat
 * gambar QR dari domain Midtrans. PNG data URL dipakai untuk tampilan & tombol unduh.
 */
export function qrPngDataUrl(qrString: string): Promise<string> {
  return QRCode.toDataURL(qrString, { errorCorrectionLevel: "M", margin: 2, width: 480 });
}
