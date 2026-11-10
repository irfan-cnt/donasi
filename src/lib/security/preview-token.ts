import "server-only";
import { getEnv } from "@/lib/env";
import { signPreviewToken, verifyPreviewToken } from "./preview-token-core";

export { PREVIEW_TTL_SECONDS } from "./preview-token-core";

/** Dipakai admin (P21) untuk membuat tautan /campaign/{slug}/pratinjau?token=… (1 jam). */
export function createCampaignPreviewToken(campaignId: string): string {
  return signPreviewToken(campaignId, getEnv().AUTH_SECRET);
}

export function readCampaignPreviewToken(token: string): string | null {
  return verifyPreviewToken(token, getEnv().AUTH_SECRET);
}
