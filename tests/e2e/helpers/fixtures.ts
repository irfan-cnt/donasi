// P26: fixture bersama — setiap test e2e otomatis gagal bila halaman memunculkan error konsol,
// error JavaScript tak tertangkap, respons 5xx, atau request gagal (jaringan) ke origin aplikasi.
//
// Yang sengaja diizinkan (diuji eksplisit oleh test masing-masing):
// - pesan konsol "Failed to load resource ... status of 4xx" → muncul saat test MEMANG membuka
//   halaman 404/403 (draft, IDOR, token salah). Status 4xx dicek oleh assertion test itu sendiri.
// - `net::ERR_ABORTED` → navigasi/prefetch yang dibatalkan oleh navigasi berikutnya (bukan error).
// Test yang memang menguji 5xx/gangguan boleh memanggil `allowNetworkErrors(testInfo)`.
import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

const ALLOW_ANNOTATION = "allow-network-errors";

export function allowNetworkErrors(info: TestInfo) {
  info.annotations.push({ type: ALLOW_ANNOTATION });
}

const EXPECTED_4XX_CONSOLE = /Failed to load resource: the server responded with a status of 4\d\d/;

function attach(page: Page, origin: string, problems: string[]) {
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (EXPECTED_4XX_CONSOLE.test(text)) return;
    problems.push(`console.error: ${text}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500 && res.url().startsWith(origin)) {
      problems.push(`HTTP ${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText ?? "";
    if (!req.url().startsWith(origin) || /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure)) return;
    problems.push(`requestfailed: ${req.method()} ${req.url()} (${failure})`);
  });
}

export const test = base.extend<{ pageHealth: void }>({
  pageHealth: [
    async ({ context, baseURL }, use, info) => {
      const origin = new URL(baseURL ?? "http://localhost:3000").origin;
      const problems: string[] = [];
      for (const p of context.pages()) attach(p, origin, problems);
      context.on("page", (p) => attach(p, origin, problems));
      await use();
      if (info.annotations.some((a) => a.type === ALLOW_ANNOTATION)) return;
      expect(problems, "error konsol / jaringan selama test (P26 scenario 22)").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Browser, Page } from "@playwright/test";
