import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { adminPagePermission } from "@/lib/admin-auth/page-permissions";

// P25 (L2): tabel permission gerbang 403 di proxy HARUS sama dengan requireAdmin(permission) di
// setiap halaman admin; halaman baru tanpa entri yang sesuai → test gagal.
const ROOT = join(process.cwd(), "src/app/admin/(panel)");

function pages(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (n === "page.tsx") out.push(p);
  }
  return out;
}

function routeOf(file: string) {
  const rel = relative(ROOT, file).replace(/\/?page\.tsx$/, "");
  return "/admin" + (rel ? `/${rel.replace(/\[[^\]]+\]/g, "x")}` : "");
}

describe("permission halaman admin (proxy 403)", () => {
  const files = pages(ROOT);
  it("menemukan halaman", () => expect(files.length).toBeGreaterThanOrEqual(12));
  for (const f of files) {
    const route = routeOf(f);
    it(route, () => {
      const src = readFileSync(f, "utf8");
      const perms = [...src.matchAll(/requireAdmin\("([a-z_.]+)"\)/g)].map((m) => m[1]);
      let expected: string | null = perms[0] ?? null;
      if (/CampaignEditorPage/.test(src)) expected = route.endsWith("/baru") ? "campaigns.write" : "campaigns.read";
      expect(adminPagePermission(route)).toBe(expected);
    });
  }
  it("CampaignEditorPage memakai permission yang sama", () => {
    const src = readFileSync(join(process.cwd(), "src/components/admin/campaign-editor-page.tsx"), "utf8");
    expect(src).toContain('requireAdmin(id ? "campaigns.read" : "campaigns.write")');
  });
});
