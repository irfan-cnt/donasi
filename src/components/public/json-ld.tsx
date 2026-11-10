import { serializeJsonLd } from "@/lib/json-ld";

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Aman: serializeJsonLd meng-escape <, >, & sehingga tidak bisa menutup tag script.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
