/** Batas terlampaui saat membaca body (H2). */
export class BodyTooLargeError extends Error {}

/**
 * Baca stream body sambil menghitung byte; batalkan begitu melewati `max` (tanpa menunggu seluruh
 * body masuk memori). Dipakai sebelum parsing multipart.
 */
export async function readCapped(stream: ReadableStream<Uint8Array> | null, max: number): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError("body melebihi batas");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}
