import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Whitelist rich text campaign/news (security.md §2). Dijalankan di server saat render
 * (data seed/editor belum menjamin tersanitasi; editor P21 juga menyanitasi saat simpan).
 * Gambar di konten tidak diizinkan — gambar lewat galeri/next/image.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "a"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer", target: "_blank" }),
    // h1/h2 di konten diturunkan agar halaman tetap punya satu H1.
    h1: "h2",
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
