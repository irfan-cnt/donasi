"use client";

import { AlertTriangle, Archive, CheckCircle2, Eye, Pause, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CampaignStatusCode } from "@/lib/campaign-rules";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/validation/admin-campaign";
import {
  changeCampaignStatusAction,
  deleteCampaignAction,
  saveCampaignAction,
} from "@/server/actions/admin-campaign-actions";
import {
  formatDigits,
  ImageThumb,
  MoneyInput,
  moveItem,
  SortControls,
  UploadButton,
  useDragSort,
} from "./admin-form-client";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { FieldError, FieldLabel, fieldClass, Panel } from "./form-bits";
import { RichTextEditor } from "./rich-text-editor";

export interface CampaignEditorValues {
  title: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  descriptionHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string;
  gallery: { key: string; url: string; alt: string; width: number | null; height: number | null }[];
  amountType: "open" | "fixed";
  minAmount: string;
  maxAmount: string;
  suggestions: string[];
  packages: { key: string; id: string | null; label: string; amount: string; description: string; isActive: boolean }[];
  useTarget: boolean;
  targetAmount: string;
  startDate: string;
  endDate: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
}

export interface CampaignEditorProps {
  campaignId: string | null;
  status: CampaignStatusCode;
  initial: CampaignEditorValues;
  categories: { id: string; name: string }[];
  canWrite: boolean;
  canPublish: boolean;
  canDelete: boolean;
  /** Slug terkunci setelah pernah terbit (H1). */
  slugLocked?: boolean;
  previewUrl: string | null;
  collectedLabel: string;
  siteHost: string;
  news: React.ReactNode;
  extra?: React.ReactNode;
}

let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function CampaignEditor(props: CampaignEditorProps) {
  const { campaignId, status, categories, canWrite, canPublish } = props;
  const router = useRouter();
  const [v, setV] = useState<CampaignEditorValues>(props.initial);
  const [slugTouched, setSlugTouched] = useState(!!campaignId);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success" | "warning"; text: string } | null>(null);
  const [newSuggestion, setNewSuggestion] = useState("");

  const set = <K extends keyof CampaignEditorValues>(key: K, value: CampaignEditorValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));
  const err = (key: string) => errors[key];
  const readOnly = !canWrite || status === "archived";

  const packageDrag = useDragSort((from, to) => set("packages", moveItem(v.packages, from, to)));
  const galleryDrag = useDragSort((from, to) => set("gallery", moveItem(v.gallery, from, to)));

  function payload() {
    return {
      title: v.title,
      slug: v.slug,
      categoryId: v.categoryId,
      shortDescription: v.shortDescription,
      descriptionHtml: v.descriptionHtml,
      featuredImageUrl: v.featuredImageUrl,
      featuredImageAlt: v.featuredImageAlt,
      gallery: v.gallery.map(({ url, alt, width, height }) => ({ url, alt, width, height })),
      amountType: v.amountType,
      minAmount: v.minAmount,
      maxAmount: v.maxAmount,
      suggestions: v.suggestions,
      packages: v.packages.map(({ id, label, amount, description, isActive }) => ({ id, label, amount, description, isActive })),
      targetAmount: v.useTarget ? v.targetAmount : null,
      startDate: v.startDate,
      endDate: v.endDate,
      isFeatured: v.isFeatured,
      seoTitle: v.seoTitle,
      seoDescription: v.seoDescription,
    };
  }

  function save(publish: boolean) {
    setMessage(null);
    start(async () => {
      const res = await saveCampaignAction(campaignId, payload(), publish);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ tone: "error", text: res.error });
        return;
      }
      setErrors({});
      if (!campaignId) {
        // Rute sebelumnya disimpan Next sebagai <Activity> tersembunyi: kosongkan form baru.
        setV(props.initial);
        setSlugTouched(false);
        router.push(`/admin/campaign/${res.id}?disimpan=1`);
        return;
      }
      setMessage(
        res.warning
          ? { tone: "warning", text: `Tersimpan. ${res.warning}` }
          : { tone: "success", text: publish ? "Campaign diterbitkan." : "Perubahan tersimpan." },
      );
      router.refresh();
    });
  }

  function changeStatus(to: "published" | "paused" | "completed" | "archived", confirmText?: string) {
    if (!campaignId) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    start(async () => {
      const res = await changeCampaignStatusAction(campaignId, to);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ tone: "error", text: res.error });
        return;
      }
      setErrors({});
      setMessage({ tone: "success", text: "Status diperbarui." });
      router.refresh();
    });
  }

  function remove() {
    if (!campaignId || !window.confirm("Hapus permanen campaign draf ini? Tindakan tidak bisa dibatalkan.")) return;
    start(async () => {
      const res = await deleteCampaignAction(campaignId);
      if (res && !res.ok) setMessage({ tone: "error", text: res.error });
    });
  }

  const seoTitle = v.seoTitle || `${v.title || "Judul campaign"} | Tebar Kebaikan`;
  const seoDesc = v.seoDescription || v.shortDescription || "Deskripsi singkat campaign akan tampil di sini.";
  const errorList = Object.entries(errors).filter(([k]) => k !== "form");

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-ink-faint">
            <Link href="/admin/campaign" className="hover:text-primary">
              Campaign
            </Link>{" "}
            / {campaignId ? "Edit" : "Baru"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{campaignId ? "Edit Campaign" : "Campaign Baru"}</h1>
          <p className="mt-1 truncate font-mono text-xs text-ink-faint">/campaign/{v.slug || "…"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.previewUrl ? (
            <a href={props.previewUrl} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Eye aria-hidden />
              Pratinjau draft
            </a>
          ) : null}
          {canPublish && status === "published" ? (
            <Button variant="outline" size="lg" disabled={pending} onClick={() => changeStatus("paused")}>
              <Pause aria-hidden />
              Jeda
            </Button>
          ) : null}
          {canPublish && status === "paused" ? (
            <Button variant="outline" size="lg" disabled={pending} onClick={() => changeStatus("published")}>
              <Play aria-hidden />
              Tayangkan lagi
            </Button>
          ) : null}
          {canPublish && (status === "published" || status === "paused") ? (
            <Button variant="outline" size="lg" disabled={pending} onClick={() => changeStatus("completed", "Tandai campaign selesai? Donasi baru tidak diterima lagi.")}>
              <CheckCircle2 aria-hidden />
              Selesaikan
            </Button>
          ) : null}
          {!readOnly ? (
            <Button variant={status === "draft" && canPublish ? "outline" : "default"} size="lg" disabled={pending} onClick={() => save(false)}>
              {pending ? "Menyimpan…" : status === "draft" ? "Simpan Draf" : "Simpan"}
            </Button>
          ) : null}
          {!readOnly && canPublish && status === "draft" ? (
            <Button size="lg" disabled={pending} onClick={() => save(true)}>
              Simpan & Terbitkan
            </Button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-5 rounded-xl border p-3 text-sm",
            message.tone === "error" && "border-danger/30 bg-danger-soft text-danger",
            message.tone === "success" && "border-success/30 bg-success-soft text-success",
            message.tone === "warning" && "border-warning/30 bg-warning-soft text-warning",
          )}
          data-testid="editor-message"
        >
          <p className="font-semibold">{message.text}</p>
          {message.tone === "error" && errorList.length ? (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {errorList.map(([k, m]) => (
                <li key={k}>{m}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {readOnly && status !== "archived" ? (
        <p className="mb-5 rounded-xl bg-muted p-3 text-sm text-ink-soft" data-testid="readonly-notice">
          Anda hanya punya akses baca untuk campaign.
        </p>
      ) : null}
      {!readOnly && !canPublish && status !== "draft" ? (
        <p className="mb-5 rounded-xl bg-info-soft p-3 text-sm text-info" data-testid="publish-notice">
          Campaign ini sedang tayang: perubahan konten langsung terlihat publik. Status dan Program Pilihan hanya bisa diubah admin dengan izin terbit.
        </p>
      ) : null}
      {status === "archived" ? (
        <p className="mb-5 rounded-xl bg-muted p-3 text-sm text-ink-soft">Campaign diarsipkan (final) dan tidak tampil publik.</p>
      ) : null}

      <fieldset disabled={readOnly || pending} className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Informasi utama">
            <div className="grid gap-4">
              <div>
                <FieldLabel htmlFor="c-title">Judul</FieldLabel>
                <input
                  id="c-title"
                  className={fieldClass}
                  value={v.title}
                  maxLength={120}
                  aria-invalid={!!err("title") || undefined}
                  onChange={(e) => {
                    const title = e.target.value;
                    setV((p) => ({ ...p, title, slug: slugTouched ? p.slug : slugify(title) }));
                  }}
                />
                <p className="mt-1 text-xs text-ink-faint">{v.title.length}/120 karakter (min. 10)</p>
                <FieldError>{err("title")}</FieldError>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <FieldLabel htmlFor="c-slug">Slug</FieldLabel>
                  <input
                    id="c-slug"
                    className={cn(fieldClass, "font-mono text-xs")}
                    value={v.slug}
                    readOnly={props.slugLocked}
                    aria-describedby={props.slugLocked ? "c-slug-locked" : undefined}
                    aria-invalid={!!err("slug") || undefined}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    }}
                  />
                  {props.slugLocked ? (
                    <p id="c-slug-locked" className="mt-1 text-xs text-ink-faint">
                      Slug terkunci karena campaign pernah terbit.
                    </p>
                  ) : null}
                  <FieldError>{err("slug")}</FieldError>
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="c-cat">Kategori</FieldLabel>
                  <select id="c-cat" className={fieldClass} value={v.categoryId} aria-invalid={!!err("categoryId") || undefined} onChange={(e) => set("categoryId", e.target.value)}>
                    <option value="">Pilih kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FieldError>{err("categoryId") ? "Pilih kategori" : undefined}</FieldError>
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="c-short">Deskripsi singkat</FieldLabel>
                <textarea id="c-short" rows={2} maxLength={200} className={cn(fieldClass, "h-auto py-2")} value={v.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
                <p className="mt-1 text-xs text-ink-faint">{v.shortDescription.length}/200 karakter</p>
                <FieldError>{err("shortDescription")}</FieldError>
              </div>
              <div>
                <FieldLabel id="c-desc-label">Deskripsi lengkap</FieldLabel>
                <RichTextEditor id="c-desc" labelledBy="c-desc-label" value={v.descriptionHtml} onChange={(html) => set("descriptionHtml", html)} invalid={!!err("descriptionHtml")} />
                <FieldError>{err("descriptionHtml")}</FieldError>
              </div>
            </div>
          </Panel>

          <Panel
            title="Nominal donasi"
            description="Terpisah dari target penggalangan"
            action={
              <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Tipe nominal">
                {(["open", "fixed"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={v.amountType === t}
                    onClick={() => set("amountType", t)}
                    className={cn("rounded-md px-3 py-1.5 text-sm font-medium", v.amountType === t ? "bg-surface text-ink shadow-sm" : "text-ink-faint")}
                  >
                    {t === "open" ? "Open amount" : "Fixed amount"}
                  </button>
                ))}
              </div>
            }
          >
            {v.amountType === "open" ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="c-min">Minimum donasi</FieldLabel>
                    <MoneyInput id="c-min" value={v.minAmount} onChange={(d) => set("minAmount", d)} invalid={!!err("minAmount")} />
                    <FieldError>{err("minAmount")}</FieldError>
                  </div>
                  <div>
                    <FieldLabel htmlFor="c-max" optional>
                      Maksimum donasi
                    </FieldLabel>
                    <MoneyInput id="c-max" value={v.maxAmount} onChange={(d) => set("maxAmount", d)} invalid={!!err("maxAmount")} />
                    <FieldError>{err("maxAmount")}</FieldError>
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="c-sugg">Saran nominal (maks. 6)</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {v.suggestions.map((s, i) => (
                      <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm tabular-nums">
                        Rp{formatDigits(s)}
                        <button type="button" aria-label={`Hapus saran Rp${formatDigits(s)}`} className="text-ink-faint hover:text-danger" onClick={() => set("suggestions", v.suggestions.filter((_, j) => j !== i))}>
                          ×
                        </button>
                      </span>
                    ))}
                    {v.suggestions.length < 6 ? (
                      <div className="flex items-center gap-2">
                        <MoneyInput id="c-sugg" label="Saran nominal baru" className="w-36" value={newSuggestion} onChange={setNewSuggestion} />
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            if (newSuggestion && !v.suggestions.includes(newSuggestion)) {
                              set("suggestions", [...v.suggestions, newSuggestion].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1)));
                            }
                            setNewSuggestion("");
                          }}
                        >
                          <Plus aria-hidden />
                          Tambah
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <FieldError>{Object.entries(errors).find(([k]) => k.startsWith("suggestions"))?.[1]}</FieldError>
                </div>
              </div>
            ) : (
              <div>
                {v.packages.length ? (
                  <ul className="divide-y divide-border rounded-xl border border-border" data-testid="package-list">
                    {v.packages.map((p, i) => (
                      <li
                        key={p.key}
                        {...packageDrag.itemProps(i)}
                        className={cn("flex items-start gap-2 p-3", packageDrag.over === i && "bg-primary-soft")}
                      >
                        <SortControls index={i} count={v.packages.length} label={`paket ${p.label || i + 1}`} onMove={(a, b) => set("packages", moveItem(v.packages, a, b))} />
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_150px]">
                          <input
                            className={cn(fieldClass, "h-9")}
                            aria-label={`Label paket ${i + 1}`}
                            placeholder="Label paket"
                            value={p.label}
                            aria-invalid={!!err(`packages.${i}.label`) || undefined}
                            onChange={(e) => set("packages", v.packages.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                          />
                          <MoneyInput
                            label={`Nominal paket ${i + 1}`}
                            value={p.amount}
                            invalid={!!err(`packages.${i}.amount`)}
                            onChange={(d) => set("packages", v.packages.map((x, j) => (j === i ? { ...x, amount: d } : x)))}
                          />
                          <input
                            className={cn(fieldClass, "h-9 sm:col-span-2")}
                            aria-label={`Deskripsi paket ${i + 1}`}
                            placeholder="Deskripsi (opsional)"
                            value={p.description}
                            onChange={(e) => set("packages", v.packages.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                          />
                          <FieldError>{err(`packages.${i}.amount`) ?? err(`packages.${i}.label`)}</FieldError>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-2">
                          <span className="text-[10px] text-ink-faint">Aktif</span>
                          <Switch
                            checked={p.isActive}
                            aria-label={`Paket ${i + 1} aktif`}
                            onCheckedChange={(c) => set("packages", v.packages.map((x, j) => (j === i ? { ...x, isActive: c } : x)))}
                          />
                          <button
                            type="button"
                            aria-label={`Hapus paket ${i + 1}`}
                            className="rounded p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
                            onClick={() => set("packages", v.packages.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-ink-faint">Belum ada paket.</p>
                )}
                <FieldError>{err("packages")}</FieldError>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="mt-3"
                  onClick={() => set("packages", [...v.packages, { key: newKey(), id: null, label: "", amount: "", description: "", isActive: true }])}
                >
                  <Plus aria-hidden />
                  Tambah paket
                </Button>
                <p className="mt-2 text-xs text-ink-faint">Paket yang pernah dipakai transaksi tidak bisa dihapus — nonaktifkan saja. Seret atau pakai tombol panah untuk mengurutkan.</p>
              </div>
            )}
          </Panel>

          <Panel title="Gambar" description="JPG/PNG/WebP maks. 2 MB, otomatis dikompresi ke WebP. Teks alternatif wajib.">
            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="min-w-0">
                <p className="mb-1.5 text-sm font-medium text-ink">Gambar utama</p>
                {v.featuredImageUrl ? (
                  <ImageThumb url={v.featuredImageUrl} alt={v.featuredImageAlt} className="aspect-[16/10] w-full" />
                ) : (
                  <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl bg-muted text-xs text-ink-faint">Belum ada gambar</div>
                )}
                <div className="mt-2">
                  <UploadButton
                    label={v.featuredImageUrl ? "Ganti gambar utama" : "Unggah gambar utama"}
                    testId="upload-featured"
                    onUploaded={(img) => set("featuredImageUrl", img.url)}
                  />
                </div>
                <input
                  className={cn(fieldClass, "mt-2 h-9 text-xs")}
                  aria-label="Teks alternatif gambar utama"
                  placeholder="Teks alternatif (wajib)"
                  value={v.featuredImageAlt}
                  aria-invalid={!!err("featuredImageAlt") || undefined}
                  onChange={(e) => set("featuredImageAlt", e.target.value)}
                />
                <FieldError>{err("featuredImageAlt")}</FieldError>
              </div>
              <div className="min-w-0">
                <p className="mb-1.5 text-sm font-medium text-ink">Galeri</p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="gallery-list">
                  {v.gallery.map((g, i) => (
                    <li key={g.key} {...galleryDrag.itemProps(i)} className={cn("min-w-0 rounded-xl", galleryDrag.over === i && "ring-2 ring-primary")}>
                      <ImageThumb url={g.url} alt={g.alt} className="aspect-square w-full" onRemove={() => set("gallery", v.gallery.filter((_, j) => j !== i))} />
                      <input
                        className={cn(fieldClass, "mt-1 h-8 text-xs")}
                        aria-label={`Teks alternatif galeri ${i + 1}`}
                        placeholder="Teks alternatif (wajib)"
                        value={g.alt}
                        aria-invalid={!!err(`gallery.${i}.alt`) || undefined}
                        onChange={(e) => set("gallery", v.gallery.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
                      />
                      <div className="mt-1 flex justify-center">
                        <SortControls index={i} count={v.gallery.length} label={`gambar ${i + 1}`} onMove={(a, b) => set("gallery", moveItem(v.gallery, a, b))} />
                      </div>
                      <FieldError>{err(`gallery.${i}.alt`)}</FieldError>
                    </li>
                  ))}
                  {v.gallery.length < 12 ? (
                    <li>
                      <UploadButton
                        compact
                        label="Tambah"
                        testId="upload-gallery"
                        onUploaded={(img) =>
                          set("gallery", [...v.gallery, { key: newKey(), url: img.url, alt: "", width: img.width, height: img.height }])
                        }
                      />
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </Panel>

          <Panel title="SEO">
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="c-seo-title" optional>
                  SEO title
                </FieldLabel>
                <input id="c-seo-title" maxLength={70} className={fieldClass} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
                <p className="mt-1 text-xs text-ink-faint">{v.seoTitle.length}/70 karakter</p>
              </div>
              <div>
                <FieldLabel htmlFor="c-seo-desc" optional>
                  SEO description
                </FieldLabel>
                <textarea id="c-seo-desc" rows={2} maxLength={160} className={cn(fieldClass, "h-auto py-2")} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
                <p className="mt-1 text-xs text-ink-faint">{v.seoDescription.length}/160 karakter</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm" aria-label="Pratinjau hasil Google">
                <p className="truncate text-info">{seoTitle}</p>
                <p className="truncate text-xs text-success">
                  {props.siteHost} › campaign › {v.slug || "…"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">{seoDesc}</p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Status & jadwal">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-faint">Status saat ini</span>
              <CampaignStatusBadge status={status} />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <FieldLabel htmlFor="c-start" optional>
                  Mulai
                </FieldLabel>
                <input id="c-start" type="date" className={fieldClass} value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="c-end" optional>
                  Berakhir
                </FieldLabel>
                <input id="c-end" type="date" className={fieldClass} value={v.endDate} aria-invalid={!!err("endDate") || undefined} onChange={(e) => set("endDate", e.target.value)} />
                <FieldError>{err("endDate")}</FieldError>
              </div>
              <label className="flex items-start gap-3 pt-1">
                <Switch checked={v.isFeatured} disabled={!canPublish} onCheckedChange={(c) => set("isFeatured", c)} aria-label="Program Pilihan" />
                <span className="text-sm">
                  <span className="block font-medium text-ink">Tampilkan sebagai Program Pilihan</span>
                  <span className="block text-xs text-ink-faint">Muncul di hero beranda</span>
                </span>
              </label>
            </div>
          </Panel>

          <Panel title="Target penggalangan">
            <label className="flex items-start gap-3">
              <Switch checked={v.useTarget} onCheckedChange={(c) => set("useTarget", c)} aria-label="Gunakan target" />
              <span className="text-sm">
                <span className="block font-medium text-ink">Gunakan target</span>
                <span className="block text-xs text-ink-faint">Tanpa target, progres ditampilkan sebagai jumlah terkumpul</span>
              </span>
            </label>
            {v.useTarget ? (
              <div className="mt-3">
                <FieldLabel htmlFor="c-target">Target</FieldLabel>
                <MoneyInput id="c-target" value={v.targetAmount} onChange={(d) => set("targetAmount", d)} invalid={!!err("targetAmount")} />
                <FieldError>{err("targetAmount")}</FieldError>
              </div>
            ) : null}
            <div className="mt-4 rounded-xl bg-muted p-3 text-sm">
              <p className="text-ink-faint">Terkumpul (otomatis)</p>
              <p className="text-lg font-bold tabular-nums">{props.collectedLabel}</p>
              <p className="text-xs text-ink-faint">Hanya bertambah dari pembayaran terverifikasi</p>
            </div>
          </Panel>

          {props.news}
          {props.extra}

          {campaignId && canWrite && status !== "archived" ? (
            <Panel title="Zona berbahaya">
              {canPublish ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => changeStatus("archived", "Arsipkan campaign? Status arsip final dan campaign tidak tampil publik.")}
                >
                  <Archive aria-hidden />
                  Arsipkan campaign
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="lg" className="mt-1 w-full text-danger" disabled={!props.canDelete} onClick={remove}>
                <Trash2 aria-hidden />
                Hapus (hanya draf tanpa transaksi)
              </Button>
              {!props.canDelete ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-faint">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Campaign ini tidak bisa dihapus permanen; arsipkan saja.
                </p>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </fieldset>
    </div>
  );
}
