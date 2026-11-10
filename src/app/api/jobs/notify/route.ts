import { createNotifyHandler } from "@/server/services/notifications/notify-handler";

// QStash → notifikasi (P16). Signature wajib (job-route.ts); lihat notification-architecture.md.
export const maxDuration = 30;

export const POST = createNotifyHandler();
