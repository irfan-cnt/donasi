import { LegalPage, legalMetadata } from "@/components/public/legal-page";
import { TERMS } from "@/lib/legal/content";

// Halaman legal (T-49, F-32). Isi & status draf: src/lib/legal/content.ts.
export const metadata = legalMetadata(TERMS);

export default function TermsPage() {
  return <LegalPage page={TERMS} />;
}
