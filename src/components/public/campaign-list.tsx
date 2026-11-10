"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { loadMoreCampaigns } from "@/server/actions/campaign-list-actions";
import type { CampaignCardData } from "@/server/queries/public-campaigns";
import { CampaignCard } from "./campaign-card";

/** Grid campaign + "Muat lebih banyak" (keyset; halaman berikut lewat server action). */
export function CampaignList({
  initialItems,
  initialCursor,
  status = "published",
  kategori,
}: {
  initialItems: CampaignCardData[];
  initialCursor: string | null;
  status?: "published" | "completed";
  kategori?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (!cursor) return;
    setFailed(false);
    startTransition(async () => {
      try {
        const page = await loadMoreCampaigns({ status, kategori, cursor });
        setItems((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...page.items.filter((c) => !seen.has(c.id))];
        });
        setCursor(page.nextCursor);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {items.map((c, i) => (
          <li key={c.id}>
            <CampaignCard c={c} layout="horizontal" priority={i === 0} />
          </li>
        ))}
      </ul>
      <ul className="hidden gap-5 md:grid md:grid-cols-3">
        {items.map((c) => (
          <li key={c.id}>
            <CampaignCard c={c} />
          </li>
        ))}
      </ul>
      {cursor ? (
        <div className="mt-6 text-center">
          <Button variant="outline" size="lg" onClick={loadMore} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Muat lebih banyak
          </Button>
          {failed ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              Gagal memuat. Silakan coba lagi.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
