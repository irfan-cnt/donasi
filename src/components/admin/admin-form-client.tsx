"use client";

import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./form-bits";

// Komponen form klien bersama editor campaign & berita (P21).

const num = new Intl.NumberFormat("id-ID");

export const digitsOnly = (v: string) => v.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
export const formatDigits = (v: string) => (v ? num.format(BigInt(v)) : "");

/** Input rupiah: state berupa string digit (bigint di server), tampilan berformat id-ID. */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  label,
  className,
}: {
  id?: string;
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-faint">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn(fieldClass, "pl-9 tabular-nums")}
        value={formatDigits(value)}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
      />
    </div>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Handle drag (HTML5) + tombol naik/turun sebagai alternatif aksesibel (keyboard/screen reader). */
export function SortControls({
  index,
  count,
  onMove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <GripVertical className="size-4 cursor-grab text-ink-faint" aria-hidden />
      <button type="button" className="rounded p-1 text-ink-faint hover:bg-muted disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Naikkan ${label}`}>
        <ArrowUp className="size-3.5" aria-hidden />
      </button>
      <button type="button" className="rounded p-1 text-ink-faint hover:bg-muted disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Turunkan ${label}`}>
        <ArrowDown className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Props drag & drop untuk item list ke-i. */
export function useDragSort(onMove: (from: number, to: number) => void) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return {
    over,
    itemProps: (i: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        dragFrom.current = i;
        e.dataTransfer.effectAllowed = "move";
      },
      onDragOver: (e: React.DragEvent) => {
        if (dragFrom.current === null) return;
        e.preventDefault();
        setOver(i);
      },
      onDragLeave: () => setOver((o) => (o === i ? null : o)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragFrom.current !== null) onMove(dragFrom.current, i);
        dragFrom.current = null;
        setOver(null);
      },
      onDragEnd: () => {
        dragFrom.current = null;
        setOver(null);
      },
    }),
  };
}

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  if (file.size > 2 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 2 MB.");
  const body = new FormData();
  body.set("file", file);
  const res = await fetch("/api/admin/images", { method: "POST", body, credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as Partial<UploadedImage> & { error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Gagal mengunggah gambar.");
  return { url: data.url, width: data.width ?? 0, height: data.height ?? 0 };
}

/** Tombol pilih berkas + unggah. */
export function UploadButton({
  label,
  onUploaded,
  testId,
  compact,
}: {
  label: string;
  onUploaded: (img: UploadedImage) => void;
  testId?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={compact ? "contents" : undefined}>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={testId}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            onUploaded(await uploadImage(file));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengunggah gambar.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className={cn(
          compact
            ? "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-xs text-ink-faint hover:border-primary hover:text-primary"
            : "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-muted",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {busy ? "Mengunggah…" : label}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ImageThumb({ url, alt, className, onRemove }: { url: string; alt: string; className?: string; onRemove?: () => void }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-muted", className)}>
      <Image src={url} alt={alt || "Pratinjau gambar"} fill sizes="240px" className="object-cover" unoptimized={url.endsWith(".svg")} />
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label="Hapus gambar" className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
