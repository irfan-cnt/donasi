"use server";

import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";

const signInSchema = z.object({ callbackUrl: z.string().max(2048).optional() });

/** Mulai OAuth Google; tujuan setelah login hanya path internal. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const parsed = signInSchema.safeParse({ callbackUrl: formData.get("callbackUrl") ?? undefined });
  const redirectTo = sanitizeCallbackUrl(parsed.success ? parsed.data.callbackUrl : undefined);
  await signIn("google", { redirectTo });
}

/** Logout donatur: Auth.js menghapus baris `sessions` dan cookie (AC-10.2). */
export async function signOutDonor(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
