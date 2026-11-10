import "server-only";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { classifyAdminSearch, previousRange, type DashboardRange } from "@/lib/validation/admin-dashboard";
import {
  getCampaignCounts,
  getDailyPaid,
  getLatestTransactions,
  getTopCampaigns,
  getTransactionKpis,
  searchCampaignsByTitle,
  searchDonorsByEmail,
  searchTransactionsByCode,
  type CampaignCounts,
  type CampaignPerformance,
  type DailyPoint,
  type LatestTransaction,
  type TransactionKpis,
} from "@/server/repositories/admin-dashboard-repository";

/**
 * Data dashboard sesuai permission (BR-40). Bagian tanpa izin = null (tidak di-query sama sekali):
 * - transactions.read → KPI transaksi, grafik harian, transaksi terbaru
 * - campaigns.read → jumlah campaign aktif, performa campaign
 */
export interface AdminDashboardData {
  range: DashboardRange;
  transactions: { kpis: TransactionKpis; daily: DailyPoint[]; latest: LatestTransaction[] } | null;
  campaigns: { counts: CampaignCounts; top: CampaignPerformance[] } | null;
}

export async function getAdminDashboard(permissions: string[], range: DashboardRange): Promise<AdminDashboardData> {
  const canTrx = hasPermission(permissions, "transactions.read");
  const canCampaigns = hasPermission(permissions, "campaigns.read");
  const prev = previousRange(range);
  const [kpis, daily, latest, counts, top] = await Promise.all([
    canTrx ? getTransactionKpis(range.from, range.to, prev.from, prev.to) : null,
    canTrx ? getDailyPaid(range.from, range.to) : null,
    canTrx ? getLatestTransactions(range.from, range.to) : null,
    canCampaigns ? getCampaignCounts() : null,
    canCampaigns ? getTopCampaigns() : null,
  ]);
  return {
    range,
    transactions: kpis && daily && latest ? { kpis, daily, latest } : null,
    campaigns: counts && top ? { counts, top } : null,
  };
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  published: "Aktif",
  paused: "Dijeda",
  completed: "Selesai",
  archived: "Diarsipkan",
};

export interface AdminSearchResult {
  type: "transaction" | "donor" | "campaign";
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Pencarian global topbar. Hasil difilter permission:
 * kode transaksi → transactions.read; email → donors.read (PII); judul campaign → campaigns.read.
 */
export async function adminSearch(permissions: string[], q: string): Promise<AdminSearchResult[]> {
  const kind = classifyAdminSearch(q);
  if (kind === "transaction") {
    if (!hasPermission(permissions, "transactions.read")) return [];
    const list = await searchTransactionsByCode(q);
    return list.map((t) => ({
      type: "transaction",
      title: t.code,
      subtitle: t.campaignTitle,
      href: `/admin/transaksi?kode=${encodeURIComponent(t.code)}`,
    }));
  }
  if (kind === "email") {
    if (!hasPermission(permissions, "donors.read")) return [];
    const list = await searchDonorsByEmail(q);
    return list.map((d) => ({
      type: "donor",
      title: d.name,
      subtitle: d.email,
      href: `/admin/donatur?id=${d.id}`,
    }));
  }
  if (!hasPermission(permissions, "campaigns.read")) return [];
  const list = await searchCampaignsByTitle(q);
  return list.map((c) => ({
    type: "campaign",
    title: c.title,
    subtitle: CAMPAIGN_STATUS_LABEL[c.status] ?? c.status,
    href: `/admin/campaign?id=${c.id}`,
  }));
}
