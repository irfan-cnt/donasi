// P26 — k6: 200 checkout/menit selama 5 menit, HANYA sampai createDonation (tanpa charge Midtrans).
//
// Alur per iterasi = donatur tanpa JavaScript (progressive enhancement server action):
//   GET /donasi/{slug}  → ambil field tersembunyi form ($ACTION_*, slug, …)
//   POST /donasi/{slug} → createDonation → 303 ke /donasi/{slug}/pembayaran?trx=TK-…
// Halaman pembayaran TIDAK dibuka & tidak ada pemilihan metode → tidak pernah ada charge.
//
// Penanda: email `k6+{RUN_ID}-{vu}-{iter}@example.test`, nama "K6 Load {RUN_ID}". Hapus sesudahnya:
//   pnpm tsx scripts/load/cleanup-k6.ts --run-id {RUN_ID} --branch <NEON_BRANCH target> [--apply]
//
// Env:
//   BASE_URL (wajib)   mis. http://localhost:3100
//   RUN_ID             default: waktu mulai (base36)
//   SLUG               campaign open-amount published (default: contoh-beasiswa-santri-penghafal-quran)
//   RATE, DURATION     default 200 (iterasi per menit) & 5m — smoke lokal: RATE=10 DURATION=20s
//   SPOOF_XFF=1        HANYA untuk server non-Vercel (next start lokal/VM): tiap iterasi memakai IP uji
//                      unik 198.18.0.0/15 (RFC 2544) di x-forwarded-for agar limit checkout-ip
//                      (10/jam/IP) tidak mendominasi. Di Vercel header ini ditimpa (x-vercel-forwarded-for).
//   BYPASS_HEADER      nilai x-vercel-protection-bypass (Deployment Protection preview), opsional.
//   EXPECT_RATE_LIMIT=1  jalankan di Vercel dari satu IP: 429/200-dengan-pesan-limit dihitung sebagai
//                      `checkout_rate_limited` (bukan error) & threshold sukses dilonggarkan.
import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE = (__ENV.BASE_URL || "").replace(/\/+$/, "");
if (!BASE) throw new Error("BASE_URL wajib diisi");
const RUN_ID = __ENV.RUN_ID || Date.now().toString(36);
const SLUG = __ENV.SLUG || "contoh-beasiswa-santri-penghafal-quran";
const RATE = Number(__ENV.RATE || 200);
const DURATION = __ENV.DURATION || "5m";
const SPOOF = __ENV.SPOOF_XFF === "1";
const EXPECT_RL = __ENV.EXPECT_RATE_LIMIT === "1";

const created = new Counter("checkout_created");
const rateLimited = new Counter("checkout_rate_limited");
const okRate = new Rate("checkout_success");
const createLatency = new Trend("checkout_create_ms", true);

export const options = {
  scenarios: {
    checkout: {
      executor: "constant-arrival-rate",
      rate: RATE,
      timeUnit: "1m",
      duration: DURATION,
      preAllocatedVUs: Math.max(5, Math.ceil(RATE / 20)),
      maxVUs: Math.max(20, Math.ceil(RATE / 4)),
    },
  },
  thresholds: {
    // AC-04.9: submit sukses → transaksi `created` + redirect ≤ 1 s (p95).
    checkout_create_ms: ["p(95)<1000"],
    checkout_success: [EXPECT_RL ? "rate>0" : "rate>0.99"],
    http_req_failed: [EXPECT_RL ? "rate<0.5" : "rate<0.01"],
    "http_req_duration{step:form}": ["p(95)<1500"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

function decode(s) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function hiddenFields(html) {
  const out = {};
  const re = /<input[^>]*type="hidden"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const name = /name="([^"]*)"/.exec(m[0]);
    if (!name) continue;
    const value = /value="([^"]*)"/.exec(m[0]);
    out[decode(name[1])] = value ? decode(value[1]) : "";
  }
  return out;
}

// Form server action tanpa JS hanya diproses Next bila multipart/form-data (encType form);
// objek biasa di k6 dikirim urlencoded → Next menyajikan ulang halaman tanpa menjalankan action.
function multipart(fields) {
  const boundary = `----k6${RUN_ID}${Math.random().toString(36).slice(2)}`;
  let body = "";
  for (const [k, v] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  return { body: `${body}--${boundary}--\r\n`, contentType: `multipart/form-data; boundary=${boundary}` };
}

function headers() {
  const h = { "user-agent": `k6-load/${RUN_ID}` };
  if (__ENV.BYPASS_HEADER) h["x-vercel-protection-bypass"] = __ENV.BYPASS_HEADER;
  if (SPOOF) {
    const o = () => Math.floor(Math.random() * 254) + 1;
    h["x-forwarded-for"] = `198.${18 + (o() % 2)}.${o()}.${o()}`;
  }
  return h;
}

export default function checkoutIteration() {
  const h = headers();
  const page = http.get(`${BASE}/donasi/${SLUG}`, { headers: h, tags: { step: "form" } });
  if (!check(page, { "form 200": (r) => r.status === 200 })) {
    okRate.add(false);
    return;
  }
  const fields = hiddenFields(page.body);
  if (!Object.keys(fields).some((k) => k.startsWith("$ACTION"))) throw new Error("field $ACTION_* tidak ditemukan di form");

  const email = `k6+${RUN_ID}-${__VU}-${__ITER}@example.test`;
  const body = Object.assign({}, fields, {
    amount: "25000",
    name: `K6 Load ${RUN_ID}`,
    email,
    website: "", // honeypot harus kosong
  });
  const form = multipart(body);
  const res = http.post(`${BASE}/donasi/${SLUG}`, form.body, {
    headers: Object.assign({ origin: BASE, "content-type": form.contentType }, h),
    redirects: 0,
    tags: { step: "create" },
  });
  const location = res.headers.Location || res.headers.location || "";
  const ok = res.status === 303 && /\/pembayaran\?trx=TK-/.test(location);
  const limited = res.status === 429 || (res.status === 200 && /terlalu banyak|coba lagi nanti/i.test(res.body || ""));
  if (ok) {
    created.add(1);
    createLatency.add(res.timings.duration);
  } else if (limited) {
    rateLimited.add(1);
  }
  okRate.add(ok);
  check(res, { "303 ke pembayaran": () => ok });
}

export function handleSummary(data) {
  const m = data.metrics;
  const line = {
    run_id: RUN_ID,
    base_url: BASE,
    created: m.checkout_created ? m.checkout_created.values.count : 0,
    rate_limited: m.checkout_rate_limited ? m.checkout_rate_limited.values.count : 0,
    create_p95_ms: m.checkout_create_ms ? m.checkout_create_ms.values["p(95)"] : null,
    success_rate: m.checkout_success ? m.checkout_success.values.rate : null,
  };
  return {
    stdout: `\nRUN_ID=${RUN_ID} → hapus data: pnpm tsx scripts/load/cleanup-k6.ts --run-id ${RUN_ID} --branch <branch> --apply\n${JSON.stringify(line)}\n`,
    [`k6-checkout-${RUN_ID}.json`]: JSON.stringify(data, null, 2),
  };
}
