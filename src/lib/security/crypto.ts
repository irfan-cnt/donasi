import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

const VERSION = "v1";

/** Kunci 32 byte dari base64. Melempar error tanpa menampilkan nilai. */
export function parseEncryptionKey(base64: string | undefined): Buffer {
  if (!base64) throw new Error("Env APP_ENCRYPTION_KEY belum diisi");
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("Env APP_ENCRYPTION_KEY harus base64 dari 32 byte");
  return key;
}

/** AES-256-GCM. Format: `v1.<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ct]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decryptWithKey(payload: string, key: Buffer): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined)
    throw new Error("Ciphertext tidak valid");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

export function encryptSecret(plaintext: string): string {
  return encryptWithKey(plaintext, parseEncryptionKey(getEnv().APP_ENCRYPTION_KEY));
}

export function decryptSecret(payload: string): string {
  return decryptWithKey(payload, parseEncryptionKey(getEnv().APP_ENCRYPTION_KEY));
}

export function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Token sesi acak 32 byte (base64url). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
