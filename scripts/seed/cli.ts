// Helper murni untuk skrip CLI (seed & admin:create). Diuji di tests/unit/seed-cli.test.ts.
import { randomInt } from "node:crypto";
import { z } from "zod";

export type SeedMode = "reference" | "sample";

/** `--reference` (default) atau `--sample`. `--sample` juga menjalankan referensi lebih dulu. */
export function parseSeedMode(argv: readonly string[]): SeedMode {
  const flags = argv.filter((a) => a.startsWith("--"));
  const unknown = flags.filter((f) => f !== "--reference" && f !== "--sample");
  if (unknown.length > 0) throw new Error(`Argumen tidak dikenal: ${unknown.join(", ")}`);
  if (flags.includes("--reference") && flags.includes("--sample")) {
    throw new Error("Pilih salah satu: --reference atau --sample");
  }
  return flags.includes("--sample") ? "sample" : "reference";
}

/** Mode sample ditolak di production. */
export function assertSampleAllowed(appEnv: string | undefined): void {
  if (appEnv === "production") {
    throw new Error("Seed contoh (--sample) ditolak: APP_ENV=production");
  }
}

const adminArgsSchema = z.object({
  email: z.email("Email tidak valid").transform((v) => v.toLowerCase()),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  role: z.enum(["owner", "admin", "finance", "editor"]),
});

export type AdminArgs = z.infer<typeof adminArgsSchema>;

/** Parse `--email <e> --name <n> --role <r>` (juga `--key=value`). */
export function parseAdminArgs(argv: readonly string[]): AdminArgs {
  const raw: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) throw new Error(`Argumen tidak dikenal: ${arg}`);
    const eq = arg.indexOf("=");
    if (eq > 0) {
      raw[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`Nilai ${arg} kosong`);
      raw[arg.slice(2)] = value;
      i++;
    }
  }
  const unknown = Object.keys(raw).filter((k) => !["email", "name", "role"].includes(k));
  if (unknown.length > 0) throw new Error(`Argumen tidak dikenal: --${unknown.join(", --")}`);
  const result = adminArgsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return result.data;
}

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%^&*-_=+?";
const ALL = LOWER + UPPER + DIGIT + SYMBOL;

/** Password acak (CSPRNG) yang memuat huruf kecil, besar, angka, dan simbol. */
export function generatePassword(length = 20): string {
  if (length < 8) throw new RangeError("Panjang password minimal 8");
  for (;;) {
    let pw = "";
    for (let i = 0; i < length; i++) pw += ALL[randomInt(ALL.length)];
    if ([LOWER, UPPER, DIGIT, SYMBOL].every((set) => [...pw].some((c) => set.includes(c)))) {
      return pw;
    }
  }
}
