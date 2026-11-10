/**
 * Serialisasi JSON-LD yang aman untuk disisipkan di <script type="application/ld+json">:
 * `<`, `>`, `&`, U+2028/U+2029 di-escape sehingga teks dari DB tidak bisa menutup tag
 * (`</script>`) atau menyuntik HTML.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
