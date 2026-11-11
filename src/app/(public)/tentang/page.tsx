import { LegalPage, legalMetadata } from "@/components/public/legal-page";
import { ABOUT } from "@/lib/legal/content";

// Halaman legal (T-49, F-32). Isi & status draf: src/lib/legal/content.ts.
export const metadata = legalMetadata(ABOUT);

export default function AboutPage() {
  return <LegalPage page={ABOUT} />;
}
