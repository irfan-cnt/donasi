"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/validation/admin-campaign";
import { deleteNewsAction, saveNewsAction, unpublishNewsAction } from "@/server/actions/admin-campaign-actions";
import { ImageThumb, UploadButton } from "./admin-form-client";
import { FieldError, FieldLabel, fieldClass } from "./form-bits";
import { RichTextEditor } from "./rich-text-editor";

export interface NewsEditorValues {
  campaignId: string;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string;
  seoTitle: string;
  seoDescription: string;
}

// Editor berita (F-25): simpan draf / terbitkan (published_at), tarik ke draf, soft delete.
export function NewsEditor({
  newsId,
  status,
  initial,
  campaigns,
  canPublish,
  closeHref,
}: {
  newsId: string | null;
  status: "draft" | "published";
  initial: NewsEditorValues;
  campaigns: { id: string; title: string }[];
  canPublish: boolean;
  closeHref: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!newsId);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof NewsEditorValues>(k: K, val: NewsEditorValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const locked = status === "published" && !canPublish;

  function save(publish: boolean) {
    setMessage(null);
    start(async () => {
      const res = await saveNewsAction(newsId, v, publish);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ ok: false, text: res.error });
        return;
      }
      setErrors({});
      setMessage({ ok: true, text: publish ? "Berita diterbitkan." : "Berita tersimpan." });
      if (!newsId && "id" in res) router.replace(`/admin/berita?edit=${res.id}`);
      else router.refresh();
    });
  }

  function act(kind: "unpublish" | "delete") {
    const q = kind === "delete" ? "Hapus berita ini? (soft delete)" : "Tarik berita ke draf? Berita tidak tampil publik lagi.";
    if (!newsId || !window.confirm(q)) return;
    start(async () => {
      const res = kind === "delete" ? await deleteNewsAction(newsId) : await unpublishNewsAction(newsId);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      if (kind === "delete") router.replace("/admin/berita");
      else router.refresh();
    });
  }

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label="Editor berita" data-testid="news-editor">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{newsId ? "Edit berita" : "Tulis berita"}</h2>
        <Link href={closeHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Tutup
        </Link>
      </div>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={cn("mt-3 rounded-lg p-2.5 text-sm", message.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} data-testid="news-message">
          {message.text}
        </p>
      ) : null}
      {locked ? <p className="mt-3 rounded-lg bg-muted p-2.5 text-sm text-ink-soft">Berita sudah terbit; perubahan butuh izin terbit.</p> : null}
      <fieldset disabled={pending || locked} className="mt-4 min-w-0 space-y-4">
        <div>
          <FieldLabel htmlFor="n-campaign">Campaign</FieldLabel>
          <select id="n-campaign" className={fieldClass} value={v.campaignId} aria-invalid={!!errors.campaignId || undefined} onChange={(e) => set("campaignId", e.target.value)}>
            <option value="">Pilih campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <FieldError>{errors.campaignId}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="n-title">Judul</FieldLabel>
          <input
            id="n-title"
            className={fieldClass}
            maxLength={150}
            value={v.title}
            aria-invalid={!!errors.title || undefined}
            onChange={(e) => {
              const title = e.target.value;
              setV((p) => ({ ...p, title, slug: slugTouched ? p.slug : slugify(title) }));
            }}
          />
          <FieldError>{errors.title}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="n-slug">Slug</FieldLabel>
          <input
            id="n-slug"
            className={cn(fieldClass, "font-mono text-xs")}
            value={v.slug}
            aria-invalid={!!errors.slug || undefined}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
          />
          <FieldError>{errors.slug}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="n-excerpt" optional>
            Ringkasan
          </FieldLabel>
          <textarea id="n-excerpt" rows={2} maxLength={300} className={cn(fieldClass, "h-auto py-2")} value={v.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </div>
        <div>
          <FieldLabel id="n-content-label">Konten</FieldLabel>
          <RichTextEditor id="n-content" labelledBy="n-content-label" value={v.contentHtml} onChange={(html) => set("contentHtml", html)} invalid={!!errors.contentHtml} />
          <FieldError>{errors.contentHtml}</FieldError>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Gambar utama</p>
          <div className="flex items-start gap-3">
            {v.featuredImageUrl ? (
              <ImageThumb url={v.featuredImageUrl} alt={v.featuredImageAlt} className="h-16 w-24 shrink-0" onRemove={() => set("featuredImageUrl", null)} />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              <UploadButton label={v.featuredImageUrl ? "Ganti gambar" : "Unggah gambar"} testId="upload-news" onUploaded={(img) => set("featuredImageUrl", img.url)} />
              <input
                className={cn(fieldClass, "h-9 text-xs")}
                aria-label="Teks alternatif gambar berita"
                placeholder="Teks alternatif (wajib bila ada gambar)"
                value={v.featuredImageAlt}
                aria-invalid={!!errors.featuredImageAlt || undefined}
                onChange={(e) => set("featuredImageAlt", e.target.value)}
              />
              <FieldError>{errors.featuredImageAlt}</FieldError>
            </div>
          </div>
        </div>
        <details className="rounded-xl border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">SEO</summary>
          <div className="mt-3 space-y-3">
            <input aria-label="SEO title" placeholder="SEO title (≤70)" maxLength={70} className={fieldClass} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
            <textarea aria-label="SEO description" placeholder="SEO description (≤160)" rows={2} maxLength={160} className={cn(fieldClass, "h-auto py-2")} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
          </div>
        </details>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {status === "draft" ? (
            <>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => save(false)}>
                Simpan Draf
              </Button>
              {canPublish ? (
                <Button type="button" size="lg" className="flex-1" onClick={() => save(true)}>
                  Terbitkan
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button type="button" size="lg" className="flex-1" onClick={() => save(false)}>
                Simpan
              </Button>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => act("unpublish")}>
                Tarik ke draf
              </Button>
            </>
          )}
          {newsId ? (
            <Button type="button" variant="ghost" size="lg" className="w-full text-danger" onClick={() => act("delete")}>
              Hapus berita
            </Button>
          ) : null}
        </div>
      </fieldset>
    </section>
  );
}
