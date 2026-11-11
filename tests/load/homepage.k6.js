// P26 — k6: homepage 50 request/detik (default 5 menit). Read-only, tidak membuat data.
//
// Env:
//   BASE_URL (wajib)  mis. http://localhost:3100
//   RPS, DURATION     default 50 & 5m — smoke lokal: RPS=5 DURATION=15s
//   BYPASS_HEADER     nilai x-vercel-protection-bypass (Deployment Protection preview), opsional.
import http from "k6/http";
import { check } from "k6";

const BASE = (__ENV.BASE_URL || "").replace(/\/+$/, "");
if (!BASE) throw new Error("BASE_URL wajib diisi");
const RPS = Number(__ENV.RPS || 50);

export const options = {
  scenarios: {
    homepage: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: __ENV.DURATION || "5m",
      preAllocatedVUs: Math.max(10, RPS),
      maxVUs: Math.max(50, RPS * 4),
    },
  },
  thresholds: {
    // NFR performa (docs/03-technical/performance.md): TTFB halaman publik ter-cache.
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
    checks: ["rate>0.99"],
    dropped_iterations: ["count<10"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const headers = { "user-agent": "k6-load/homepage" };
if (__ENV.BYPASS_HEADER) headers["x-vercel-protection-bypass"] = __ENV.BYPASS_HEADER;

export default function homepageIteration() {
  const res = http.get(`${BASE}/`, { headers });
  check(res, {
    "200": (r) => r.status === 200,
    "satu H1 hero": (r) => /<h1[\s>]/.test(r.body || ""),
  });
}
