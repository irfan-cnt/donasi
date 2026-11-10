"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
import { Button } from "@/components/ui/button";

export default function PublicError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <EmptyState
        icon={WifiOff}
        title="Gagal memuat data"
        description={`Periksa koneksi internetmu lalu coba lagi. Jika masalah berlanjut, hubungi kami${error.digest ? ` dengan kode ${error.digest}` : ""}.`}
        action={
          <Button variant="outline" onClick={() => retry()}>
            <RefreshCw aria-hidden />
            Coba lagi
          </Button>
        }
      />
    </div>
  );
}
