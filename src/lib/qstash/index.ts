import "server-only";
import { Client, Receiver } from "@upstash/qstash";
import { getEnv, requireEnvValue } from "@/lib/env";

let client: Client | undefined;
let receiver: Receiver | undefined;

export function getQStash(): Client {
  client ??= new Client({ token: requireEnvValue(getEnv(), "QSTASH_TOKEN") });
  return client;
}

/** Publish job JSON ke endpoint internal (URL absolut). */
export async function publishJob(
  url: string,
  body: unknown,
  options: { delaySeconds?: number; deduplicationId?: string; retries?: number } = {},
): Promise<string> {
  const res = await getQStash().publishJSON({
    url,
    body,
    delay: options.delaySeconds,
    deduplicationId: options.deduplicationId,
    retries: options.retries,
  });
  return res.messageId;
}

/**
 * Verifikasi signature QStash (header `Upstash-Signature`) atas body mentah.
 * Mengembalikan false (bukan throw) bila tidak valid.
 */
export async function verifyQStashSignature(
  signature: string | null,
  rawBody: string,
  url?: string,
): Promise<boolean> {
  if (!signature) return false;
  const env = getEnv();
  receiver ??= new Receiver({
    currentSigningKey: requireEnvValue(env, "QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: requireEnvValue(env, "QSTASH_NEXT_SIGNING_KEY"),
  });
  try {
    return await receiver.verify({ signature, body: rawBody, url });
  } catch {
    return false;
  }
}
