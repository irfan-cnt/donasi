import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutForm, type CheckoutPrefill } from "@/components/public/checkout-form";
import { FlowLayout } from "@/components/public/flow-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getOptionalDonor } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { getCheckoutView } from "@/server/services/donation-service";

// Checkout Form (F-04, T-19). Dinamis & blocking (sesi donatur untuk prefill; status campaign
// harus segar untuk BR-03); slug draft/archived/tidak ada → 404 sungguhan. Tidak diindeks.
export const instant = false;

export const metadata: Metadata = {
  title: `Donasi — ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

async function loadPrefill(): Promise<CheckoutPrefill | null> {
  const donor = await getOptionalDonor();
  if (!donor) return null;
  return {
    name: donor.anonymizedAt ? "" : donor.name,
    email: donor.email,
    phone: donor.phoneE164 ? `0${donor.phoneE164.slice(3)}` : "",
    whatsappOptIn: donor.whatsappOptIn,
    defaultAnonymous: donor.defaultAnonymous,
  };
}

export default async function CheckoutPage({ params }: PageProps<"/donasi/[slug]">) {
  const { slug } = await params;
  const [view, prefill] = await Promise.all([getCheckoutView(slug), loadPrefill()]);
  if (!view) notFound();
  const { campaign: c } = view;
  const back = `/campaign/${c.slug}`;
  const image = c.featuredImageUrl;

  return (
    <FlowLayout title="Donasi" backHref={back} step={1} withFooter={!view.blockedReason}>
      <div className="flex gap-3">
        {image && (
          <Image
            src={image}
            alt={c.featuredImageAlt ?? c.title}
            width={80}
            height={64}
            unoptimized={image.endsWith(".svg")}
            className="h-16 w-20 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="text-xs text-ink-faint">Kamu akan berdonasi untuk</p>
          <p className="line-clamp-2 text-sm leading-snug font-semibold">{c.title}</p>
        </div>
      </div>

      {view.blockedReason ? (
        <>
          <Alert className="mt-5">
            <AlertTitle>Donasi tidak tersedia</AlertTitle>
            <AlertDescription>{view.blockedReason}</AlertDescription>
          </Alert>
          <Link href={back} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 h-11 w-full")}>
            Kembali ke halaman program
          </Link>
        </>
      ) : (
        <CheckoutForm
          slug={c.slug}
          amountType={c.amountType}
          min={view.bounds.min.toString()}
          max={view.bounds.max.toString()}
          options={view.options.map((o) => ({
            id: o.id,
            label: o.label,
            amount: o.amount.toString(),
            description: o.description,
          }))}
          prefill={prefill}
          loginHref={`/masuk?callbackUrl=${encodeURIComponent(`/donasi/${c.slug}`)}`}
        />
      )}
    </FlowLayout>
  );
}
