"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { adminSearchAction, type AdminSearchState } from "@/server/actions/admin-search-actions";

const TYPE_LABEL = { transaction: "Transaksi", donor: "Donatur", campaign: "Campaign" } as const;

/** Pencarian global topbar: kode transaksi / email donatur / judul campaign (hasil sesuai permission). */
export function AdminSearch() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<AdminSearchState | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const id = ++seq.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await adminSearchAction({ q: term });
        if (id === seq.current) setState(res);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const show = open && q.trim().length >= 2 && state !== null;

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (e.target.value.trim().length < 2) setState(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        maxLength={100}
        aria-label="Pencarian global admin"
        aria-controls={listId}
        aria-expanded={show}
        role="combobox"
        placeholder="Cari kode transaksi, email, campaign…"
        className="h-10 w-full rounded-xl border border-border bg-muted/60 pr-3 pl-9 text-sm placeholder:text-ink-faint focus:border-primary focus:outline-none"
        data-testid="admin-search"
      />
      {show ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
          data-testid="admin-search-results"
        >
          {state.error ? (
            <p className="px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : state.results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-faint">{pending ? "Mencari…" : "Tidak ada hasil."}</p>
          ) : (
            state.results.map((r) => (
              <Link
                key={`${r.type}:${r.href}`}
                href={r.href}
                role="option"
                aria-selected={false}
                className="block rounded-lg px-3 py-2 hover:bg-muted"
              >
                <span className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                  {TYPE_LABEL[r.type]}
                </span>
                <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                <span className="block truncate text-xs text-ink-faint">{r.subtitle}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
