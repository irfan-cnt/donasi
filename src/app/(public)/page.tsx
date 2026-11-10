import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="container flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <HeartHandshake className="size-7" aria-hidden />
      </span>
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Tebar Kebaikan</h1>
      <p className="max-w-md text-ink-soft">
        Platform donasi &amp; crowdfunding Islami. Halaman ini adalah kerangka awal proyek.
      </p>
      <Button>Mulai Berdonasi</Button>
    </main>
  );
}
