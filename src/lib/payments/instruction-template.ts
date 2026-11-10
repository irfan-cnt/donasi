import { z } from "zod";

// Langkah bayar dari payment_methods.instructions (JSONB, diedit admin — P22). Placeholder
// {{va_number}}, {{amount}}, {{bank_name}} diisi dari payments.instruction. Hasilnya TEKS biasa:
// dirender sebagai text node React (otomatis di-escape), tidak pernah sebagai HTML.

export const instructionSectionsSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(120),
      steps: z.array(z.string().trim().min(1).max(500)).max(20),
    }),
  )
  .max(10);

export type InstructionSection = z.infer<typeof instructionSectionsSchema>[number];

export interface InstructionVars {
  va_number?: string;
  amount?: string;
  bank_name?: string;
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;
// Karakter kontrol & bidi-override dibuang agar langkah tidak bisa menyamarkan teks.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f‪-‮⁦-⁩]/g;

/** Isi placeholder; placeholder tak dikenal/kosong → "-". Tidak pernah menghasilkan HTML. */
export function fillPlaceholders(text: string, vars: InstructionVars): string {
  return text
    .replace(PLACEHOLDER, (_, name: string) => {
      const value = (vars as Record<string, string | undefined>)[name];
      return value ? value : "-";
    })
    .replace(UNSAFE_CHARS, "");
}

/** Validasi JSONB (data tidak valid → []) lalu isi placeholder di judul & langkah. */
export function renderInstructionSections(raw: unknown, vars: InstructionVars): InstructionSection[] {
  const parsed = instructionSectionsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.map((s) => ({
    title: fillPlaceholders(s.title, vars),
    steps: s.steps.map((step) => fillPlaceholders(step, vars)),
  }));
}
