// Helper KHUSUS TEST (read-only): data publik campaign + PII donatur untuk uji kebocoran.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { signPreviewToken } from "../../../src/lib/security/preview-token-core";

config({ path: ".env.local", quiet: true });

function sql() {
  if (process.env.NEON_BRANCH !== "dev") {
    throw new Error("E2E hanya diizinkan bila NEON_BRANCH=dev");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak tersedia untuk e2e");
  return neon(url);
}

export async function getCampaignId(slug: string): Promise<string> {
  const rows = await sql()`select id from campaigns where slug = ${slug}`;
  if (!rows[0]) throw new Error(`Campaign ${slug} belum di-seed (pnpm db:seed:sample)`);
  return rows[0].id as string;
}

/** Token pratinjau dengan AUTH_SECRET server uji (sama dengan .env.local). */
export function previewToken(campaignId: string, nowMs = Date.now()): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET tidak tersedia untuk e2e");
  return signPreviewToken(campaignId, secret, nowMs);
}

/** Semua email & nomor WA donatur yang bertransaksi paid di campaign (donor + snapshot). */
export async function getDonorPii(slug: string): Promise<string[]> {
  const rows = await sql()`
    select d.email, d.phone_e164, t.donor_email_snapshot, t.donor_phone_snapshot
    from transactions t join donors d on d.id = t.donor_id join campaigns c on c.id = t.campaign_id
    where c.slug = ${slug}`;
  const out = new Set<string>();
  for (const r of rows) {
    for (const email of [r.email, r.donor_email_snapshot]) if (email) out.add(String(email).toLowerCase());
    for (const phone of [r.phone_e164, r.donor_phone_snapshot]) {
      if (!phone) continue;
      const p = String(phone);
      out.add(p);
      if (p.startsWith("+62")) {
        out.add(`0${p.slice(3)}`);
        out.add(p.slice(1));
      }
    }
  }
  return [...out];
}
