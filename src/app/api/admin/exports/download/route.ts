import { getRequestMeta, requireAdminApi } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { writeAudit } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { verifyExportToken } from "@/lib/exports/export-token";
import { exportKey, getExportStore } from "@/lib/storage/export-storage";
import { EXPORT_PERMISSION, exportFileName, exportStatus } from "@/server/services/admin-export-service";

// GET /api/admin/exports/download?t=<token>[&cek=1] — unduh berkas ekspor async (F-27).
// Token HMAC berlaku 1 jam & terikat admin peminta; route TETAP memeriksa sesi + permission dan
// mencocokkan admin sesi dengan admin di token. `cek=1` → status JSON (untuk polling UI).
const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const claims = verifyExportToken(url.searchParams.get("t") ?? "", getEnv().AUTH_SECRET);
  if (!claims) return json(404, { error: "Tautan unduhan tidak valid atau sudah kedaluwarsa." });
  const guard = await requireAdminApi(EXPORT_PERMISSION[claims.kind]);
  if (!guard.ok) return guard.response;
  if (guard.ctx.adminId !== claims.adminId) return json(403, { error: "Tautan ini milik admin lain." });
  // L2: berkas berisi PII penuh hanya untuk admin yang SAAT INI memegang donors.export.
  if (!claims.masked && !hasPermission(guard.ctx.permissions, "donors.export")) {
    return json(403, { error: "Anda tidak lagi punya izin melihat data donatur lengkap." });
  }

  const store = getExportStore();
  if (url.searchParams.get("cek") === "1") {
    return json(200, { status: await exportStatus(claims.kind, claims.exportId, store) });
  }
  const stream = store ? await store.get(exportKey(claims.kind, claims.exportId)) : null;
  if (!stream) return json(409, { error: "Berkas belum siap. Coba lagi sebentar lagi." });
  const meta = await getRequestMeta();
  await writeAudit({
    actor: { type: "admin", id: guard.ctx.adminId },
    action: "export.download",
    entityType: "export",
    entityId: claims.exportId,
    metadata: { kind: claims.kind },
    ip: meta.ip,
    ua: meta.ua,
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(claims.kind)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
