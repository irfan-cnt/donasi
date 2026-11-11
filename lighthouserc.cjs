// Lighthouse CI (P24, NFR-01/03/04/15). Dipakai .github/workflows/lighthouse.yml terhadap
// `next start` (build produksi) di runner CI. Budget = docs/03-technical/performance.md.
const base = process.env.LHCI_BASE_URL || "http://localhost:3100";
const slug = process.env.LHCI_CAMPAIGN_SLUG || "contoh-renovasi-masjid-desa";

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/campaign/${slug}`, `${base}/donasi/${slug}`],
      numberOfRuns: 3,
      settings: {
        // Default Lighthouse = mobile + simulated throttling (Moto G Power, slow 4G).
        onlyCategories: ["performance", "seo"],
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: ".*",
          // Median dari 3 run per URL.
          aggregationMethod: "median-run",
          assertions: {
            "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
            "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
            // JS first-load ≤ 150 KB gzip (transfer size; next start mengompres gzip).
            "resource-summary:script:size": ["error", { maxNumericValue: 153600 }],
            "categories:performance": ["warn", { minScore: 0.9 }],
          },
        },
        {
          // SEO halaman publik terindeks. Skor kategori SEO tidak dipakai: CI berjalan dengan
          // APP_ENV=development sehingga situs sengaja noindex (is-crawlable gagal by design).
          matchingUrlPattern: "^(?!.*/donasi/).*$",
          aggregationMethod: "median-run",
          assertions: Object.fromEntries(
            [
              "document-title",
              "meta-description",
              "canonical",
              "http-status-code",
              "link-text",
              "crawlable-anchors",
              "image-alt",
              "hreflang",
            ].map((id) => [id, ["error", { minScore: 1 }]]),
          ),
        },
      ],
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
