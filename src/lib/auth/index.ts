import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { findDonorByUserId, type DonorRow } from "@/server/repositories/donor-repository";
import { ensureDonorAccount, normalizeEmail } from "@/server/services/donor-account-service";
import { DEFAULT_DONOR_CALLBACK, sanitizeCallbackUrl } from "./callback-url";

const DAY = 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
      // Kolom email ber-tipe citext (custom type) — kompatibel di runtime, tidak di tipe adapter.
    } as never),
    secret: env.AUTH_SECRET,
    trustHost: true,
    // Cookie `__Secure-authjs.session-token` (HttpOnly, SameSite=Lax) otomatis bila AUTH_URL https.
    useSecureCookies: env.AUTH_URL?.startsWith("https://") ?? env.APP_ENV !== "development",
    session: { strategy: "database", maxAge: 30 * DAY, updateAge: DAY },
    pages: { signIn: "/masuk", error: "/masuk" },
    providers: [
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        // Email ternormalisasi sebelum disimpan ke users.
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: normalizeEmail(profile.email),
            image: profile.picture,
          };
        },
      }),
    ],
    callbacks: {
      // AC-09.2: tolak email Google yang tidak terverifikasi.
      signIn({ account, profile }) {
        if (account?.provider !== "google") return false;
        return profile?.email_verified === true;
      },
      // AC-09.3: hanya redirect ke path internal.
      redirect({ url, baseUrl }) {
        const relative = url.startsWith(baseUrl) ? url.slice(baseUrl.length) || "/" : url;
        return `${baseUrl}${sanitizeCallbackUrl(relative)}`;
      },
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
    events: {
      async signIn({ user }) {
        await ensureDonorAccount(user);
      },
    },
    logger: {
      error(error) {
        logger.error("auth: error", { name: error.name, message: error.message });
      },
      warn(code) {
        logger.warn("auth: warn", { code });
      },
      debug() {},
    },
  };
});

export interface DonorSession {
  userId: string;
  donorId: string;
  email: string;
  name: string;
}

/**
 * Guard donatur (security.md §3). Panggil di setiap halaman/action/route donor.
 * Tanpa sesi → redirect ke /masuk?callbackUrl=<path>.
 */
export async function requireDonor(
  callbackPath: string = DEFAULT_DONOR_CALLBACK,
): Promise<DonorSession> {
  await connection(); // selalu dinamis: jangan prerender data sesi
  const session = await auth();
  const userId = session?.user?.id;
  const loginUrl = `/masuk?callbackUrl=${encodeURIComponent(sanitizeCallbackUrl(callbackPath))}`;
  if (!userId) redirect(loginUrl);

  const donor =
    (await findDonorByUserId(userId)) ??
    (await ensureDonorAccount({
      id: userId,
      email: session.user?.email,
      name: session.user?.name,
    }));
  if (!donor) redirect(loginUrl);
  return { userId, donorId: donor.id, email: donor.email, name: donor.name };
}

/**
 * Donor dari sesi bila ada (tanpa redirect) — untuk halaman publik seperti checkout (AC-04.7).
 * Membuat baris donor bila belum ada, sama seperti requireDonor().
 */
export async function getOptionalDonor(): Promise<DonorRow | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const donor =
    (await findDonorByUserId(userId)) ??
    (await ensureDonorAccount({ id: userId, email: session.user?.email, name: session.user?.name }));
  return donor ?? null;
}
