# Roadmap

Estimasi untuk 1 full-stack engineer senior + dukungan agent (Claude). Kalender menyesuaikan tanggal persetujuan Phase 1.

```mermaid
gantt
  dateFormat  YYYY-MM-DD
  title Tebar Kebaikan — Roadmap indikatif
  section Phase 1
  Concepting & review           :done,    p1, 2026-11-09, 7d
  section Phase 2
  M1 Setup & DB                  :         m1, after p1, 5d
  M2 Auth (donor & admin)        :         m2, after m1, 4d
  M3 Public site + checkout      :         m3, after m2, 8d
  M4 Payments (Midtrans)        :crit,    m4, after m3, 7d
  M5 Notifications               :         m5, after m4, 4d
  M6 Donor dashboard + PDF       :         m6, after m4, 5d
  M7 Admin panel                 :         m7, after m5, 10d
  M8 Jobs, hardening, testing    :crit,    m8, after m7, 7d
  UAT & go/no-go                 :         uat, after m8, 5d
  section Phase 3
  Landing page & Instagram kit   :         p3, after uat, 7d
```

| Milestone | Hasil | Exit criteria |
|---|---|---|
| M1 | Repo, CI, Vercel, Neon, Upstash, skema + seed | App jalan lokal & preview; migrasi dari kosong sukses |
| M2 | Google login, sesi, admin login + TOTP, RBAC | Test otorisasi negatif hijau |
| M3 | 8 halaman publik (tanpa provider nyata: adapter `fake` hanya di test) | E2E checkout sampai Select Payment |
| M4 | Payment abstraction + adapter Midtrans Core API, webhook, idempotensi | Sandbox Midtrans paid/expired/duplikat lulus |
| M5 | Email & WA + template + log | Notifikasi sandbox terkirim, retry teruji |
| M6 | Dashboard donatur, riwayat, PDF | IDOR test hijau |
| M7 | Admin lengkap | AC F-22..F-30 lulus |
| M8 | QStash jobs, rekonsiliasi, perf & security review | Release checklist hijau |
| UAT | Uji PM + lembaga | Go/no-go |

Total Phase 2 indikatif: **±9–11 minggu kalender** (termasuk buffer verifikasi merchant payment gateway yang sering menjadi jalur kritis).
