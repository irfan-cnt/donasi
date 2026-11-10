import { getRequestMeta, requireAdminApi } from "@/lib/admin-auth";
import { readCapped, BodyTooLargeError } from "@/lib/http/read-capped";
import { safeError } from "@/lib/jobs/job-route";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { siteUrl } from "@/lib/site";
import { EXPORT_PERMISSION, runtimeExportDeps, startExport } from "@/server/services/admin-export-service";

// POST /api/admin/exports — ekspor CSV transaksi/donatur sesuai filter (F-27, F-28; AC-27.2, AC-28.1).
// Guard: sesi admin + permission ekspor sesuai jenis (401/403 HTTP nyata), cek Origin kanonik,
// rate limit. ≤ 10.000 baris → stream CSV; lebih → antre QStash + tautan unduh bertanda tangan.
export const maxDuration = 60;

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = JSON.parse((await readCapped(req.body, 4096)).toString("utf8"));
  } catch (error) {
    return json(error instanceof BodyTooLargeError ? 413 : 400, { error: "Permintaan ekspor tidak valid." });
  }
  const kind = (body as { kind?: unknown } | null)?.kind;
  if (kind !== "transactions" && kind !== "donors") return json(400, { error: "Permintaan ekspor tidak valid." });
  const guard = await requireAdminApi(EXPORT_PERMISSION[kind]);
  if (!guard.ok) return guard.response;
  if (!sameOrigin(req)) return json(403, { error: "Permintaan ditolak." });
  const limit = await rateLimit("admin-export", guard.ctx.adminId, 10, "10 m");
  if (!limit.success) return json(429, { error: "Terlalu banyak ekspor. Coba lagi beberapa menit lagi." });

  const meta = await getRequestMeta();
  const actor = { adminId: guard.ctx.adminId, permissions: guard.ctx.permissions, ip: meta.ip, ua: meta.ua };
  try {
    const r = await startExport(actor, body, runtimeExportDeps());
    if (r.mode === "error") return json(r.status, { error: r.error });
    if (r.mode === "async") {
      return json(202, {
        mode: "async",
        rows: r.rows,
        downloadUrl: `/api/admin/exports/download?t=${encodeURIComponent(r.token)}`,
        expiresAt: r.expiresAt.toISOString(),
      });
    }
    return new Response(r.stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${r.fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Rows": String(r.rows),
      },
    });
  } catch (error) {
    logger.error("ekspor gagal", { error: safeError(error) });
    return json(500, { error: "Ekspor gagal. Silakan coba lagi." });
  }
}
