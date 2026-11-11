import { Suspense } from "react";
import { LegalPage, legalMetadata } from "@/components/public/legal-page";
import { CONTACT } from "@/lib/legal/content";
import { getOrganizationContact } from "@/server/queries/public-organization";

// Kontak (F-32, AC-32.4): data dari platform_settings `organization.*` (tanpa formulir, tanpa
// secret). Kunci kosong → barisnya disembunyikan.
export const metadata = legalMetadata(CONTACT);

function waLink(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^0/, "62");
  return /^62\d{8,13}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

async function ContactDetails() {
  const org = await getOrganizationContact();
  const rows: { label: string; value: string; href?: string | null }[] = [];
  if (org.name) rows.push({ label: "Pengelola", value: org.name });
  if (org.email) rows.push({ label: "Email", value: org.email, href: `mailto:${org.email}` });
  if (org.whatsapp)
    rows.push({ label: "WhatsApp", value: org.whatsapp, href: waLink(org.whatsapp) });
  if (org.address) rows.push({ label: "Alamat", value: org.address });
  if (rows.length === 0) return null;
  return (
    <dl
      data-testid="organization-contact"
      className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface"
    >
      {rows.map((r) => (
        <div key={r.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[8rem_1fr]">
          <dt className="text-sm font-semibold text-ink">{r.label}</dt>
          <dd className="break-words text-ink-soft">
            {r.href ? (
              <a
                href={r.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
                rel="noopener noreferrer"
              >
                {r.value}
              </a>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ContactPage() {
  return (
    <LegalPage page={CONTACT}>
      <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded-2xl bg-muted" />}>
        <ContactDetails />
      </Suspense>
    </LegalPage>
  );
}
