import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  LEGAL_DRAFT_NOTICE,
  LEGAL_FINAL,
  LEGAL_UPDATED_AT,
  legalRobots,
  type LegalPageContent,
} from "@/lib/legal/content";
import { SITE_NAME } from "@/lib/site";

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

export function legalMetadata(page: LegalPageContent): Metadata {
  return {
    title: `${page.title} — ${SITE_NAME}`,
    description: page.description,
    alternates: { canonical: page.path },
    robots: legalRobots(),
  };
}

/** Kerangka halaman legal (T-49): satu H1, banner draf + tanggal di atas, isi dari content.ts. */
export function LegalPage({ page, children }: { page: LegalPageContent; children?: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      {!LEGAL_FINAL && (
        <p
          role="note"
          data-testid="legal-draft-notice"
          className="mb-6 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-ink"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {LEGAL_DRAFT_NOTICE}
        </p>
      )}
      <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{page.title}</h1>
      <p className="mt-2 text-sm text-ink-faint">
        Terakhir diperbarui:{" "}
        <time dateTime={LEGAL_UPDATED_AT}>
          {dateFmt.format(new Date(`${LEGAL_UPDATED_AT}T00:00:00+07:00`))}
        </time>
      </p>
      <p className="mt-6 leading-relaxed text-ink-soft">{page.intro}</p>
      {children}
      {page.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-xl font-bold text-ink">{s.heading}</h2>
          {s.body.map((b, i) =>
            typeof b === "string" ? (
              <p key={i} className="mt-3 leading-relaxed text-ink-soft">
                {b}
              </p>
            ) : (
              <ul key={i} className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-soft">
                {b.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
