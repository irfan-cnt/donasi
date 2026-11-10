"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_LOGIN_PATH,
  endAdminSession,
  getRequestMeta,
  requireAdmin,
  startAdminSession,
} from "@/lib/admin-auth";
import { revokeOtherAdminSessions } from "@/server/repositories/admin-repository";
import {
  authenticateAdmin,
  changeAdminPassword,
  confirmTotpSetup,
} from "@/server/services/admin-auth-service";

export interface FormState {
  error?: string;
}

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  totp: z
    .string()
    .trim()
    .max(6)
    .regex(/^\d{0,6}$/)
    .optional(),
});

const MESSAGES = {
  invalid: "Email, password, atau kode autentikator salah.",
  locked: "Akun dikunci sementara. Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.",
  // Sama dengan `locked` agar tidak membedakan rate limit IP+email dari lockout akun.
  rate_limited: "Akun dikunci sementara. Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.",
} as const;

export async function loginAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") ?? undefined,
  });
  if (!parsed.success) return { error: MESSAGES.invalid };

  const meta = await getRequestMeta();
  const result = await authenticateAdmin(
    {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp || undefined,
    },
    meta,
  );
  if (!result.ok) return { error: MESSAGES[result.reason] };

  await startAdminSession(result.adminId);
  redirect("/admin"); // requireAdmin mengarahkan ke langkah wajib bila belum selesai
}

export async function logoutAdmin(): Promise<void> {
  await endAdminSession();
  redirect(ADMIN_LOGIN_PATH);
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z
      .string()
      .min(12, "Password baru minimal 12 karakter.")
      .max(128, "Password baru maksimal 128 karakter."),
    confirmPassword: z.string().max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requireAdmin(null, { allowPendingStep: true });
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };

  const result = await changeAdminPassword(ctx.adminId, parsed.data, await getRequestMeta());
  if (!result.ok) {
    return {
      error:
        result.reason === "same_as_old"
          ? "Password baru tidak boleh sama dengan password lama."
          : "Password saat ini salah.",
    };
  }
  // Cabut sesi lain lalu rotasi sesi ini.
  await revokeOtherAdminSessions(ctx.adminId, ctx.sessionId);
  await startAdminSession(ctx.adminId);
  redirect("/admin");
}

const totpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

export async function confirmTotpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireAdmin(null, { allowPendingStep: true });
  if (ctx.mustChangePassword) redirect("/admin/ganti-password");
  const parsed = totpSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Masukkan 6 digit kode dari aplikasi autentikator." };
  const result = await confirmTotpSetup(ctx.adminId, parsed.data.code, await getRequestMeta());
  if (!result.ok) return { error: "Kode tidak cocok. Pastikan jam HP sesuai lalu coba lagi." };
  redirect("/admin");
}
