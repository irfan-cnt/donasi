import { LegalPage, legalMetadata } from "@/components/public/legal-page";
import { PRIVACY } from "@/lib/legal/content";

// Halaman legal (T-49, F-32). Isi & status draf: src/lib/legal/content.ts.
export const metadata = legalMetadata(PRIVACY);

export default function PrivacyPage() {
  return <LegalPage page={PRIVACY} />;
}
