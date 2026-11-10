import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/donor/delete-account-form";
import { ProfileForm } from "@/components/donor/profile-form";
import { requireDonor } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";
import { findDonorByUserId } from "@/server/repositories/donor-repository";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: `Profil — ${SITE_NAME}` };

// Profil donatur (F-15, AC-15.x). Email read-only dari Google.
export default async function DonorProfilePage() {
  const session = await requireDonor("/akun/profil");
  const donor = await findDonorByUserId(session.userId);
  if (!donor || donor.id !== session.donorId) notFound();
  return (
    <>
      <h1 className="text-xl font-bold text-ink md:text-2xl">Profil</h1>
      <div className="mt-4 space-y-5">
        <ProfileForm
          defaults={{
            name: donor.name,
            email: donor.email,
            phone: donor.phoneE164 ? `0${donor.phoneE164.slice(3)}` : "",
            whatsappOptIn: donor.whatsappOptIn,
            defaultAnonymous: donor.defaultAnonymous,
          }}
        />
        <DeleteAccountForm />
      </div>
    </>
  );
}
