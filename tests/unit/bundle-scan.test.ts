import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clientFiles, FORBIDDEN_PATTERNS, scanFiles } from "../../scripts/lib/bundle-scan";

// P25 (T-48): pemindai secret di output build klien. Fixture di folder sementara; "secret" di
// sini nilai palsu buatan test.
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function fakeNext(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "bundle-scan-"));
  dirs.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, ".next", rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

describe("bundle-scan", () => {
  it("mencakup semua nama secret dari CLAUDE.md & playbook", () => {
    for (const n of ["SB-Mid-server", "Mid-server", "GMAIL", "FONNTE", "DATABASE_URL", "AUTH_SECRET", "QSTASH_",
      "APP_ENCRYPTION_KEY", "UPSTASH_REDIS_REST_TOKEN", "BLOB_READ_WRITE_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
      expect(FORBIDDEN_PATTERNS).toContain(n);
    }
  });

  it("bersih → tanpa temuan; server-only (.next/server/chunks) tidak dipindai", () => {
    const root = fakeNext({
      "static/chunks/a.js": "console.log('halo')",
      "server/chunks/ssr.js": "process.env.DATABASE_URL",
    });
    const files = clientFiles(join(root, ".next"));
    expect(files).toHaveLength(1);
    expect(scanFiles(files, root, {})).toEqual([]);
  });

  it("pola nama di chunk klien & HTML prerender terdeteksi", () => {
    const root = fakeNext({
      "static/chunks/a.js": 'x="SB-Mid-server-abc"',
      "server/app/index.html": "<script>GMAIL_APP_PASSWORD</script>",
    });
    const names = scanFiles(clientFiles(join(root, ".next")), root, {}).map((f) => `${f.file}:${f.name}`);
    expect(names).toEqual(expect.arrayContaining([
      expect.stringMatching(/a\.js:SB-Mid-server$/),
      expect.stringMatching(/a\.js:Mid-server$/),
      expect.stringMatching(/index\.html:GMAIL$/),
    ]));
  });

  it("NILAI secret dari env terdeteksi tanpa ikut dicetak; nilai pendek diabaikan", () => {
    const fakeSecret = "fake-qstash-token-for-unit-test-0001";
    const root = fakeNext({ "static/chunks/b.js": `fetch("x",{headers:{a:"${fakeSecret}"}})` });
    const findings = scanFiles(clientFiles(join(root, ".next")), root, { QSTASH_TOKEN: fakeSecret, AUTH_SECRET: "short" });
    expect(findings).toEqual([{ file: expect.stringMatching(/b\.js$/), kind: "value", name: "QSTASH_TOKEN" }]);
    expect(JSON.stringify(findings)).not.toContain(fakeSecret);
  });
});
